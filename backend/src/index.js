/**
 * Smart City Backend — Express + Postgres + Redis (BullMQ)
 */
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { Queue } from 'bullmq'
import pg from 'pg'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'

const {
  PORT = 3333,
  HOST = '0.0.0.0',
  DB_HOST = 'postgres',
  DB_PORT = 5432,
  DB_USER = 'smartcity',
  DB_PASSWORD = 'smartcity',
  DB_DATABASE = 'smartcity',
  REDIS_HOST = 'redis',
  REDIS_PORT = 6379,
  UPLOADS_DIR = '/app/uploads',
} = process.env

// --- Postgres pool ---------------------------------------------------------
const pool = new pg.Pool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_DATABASE,
})

async function ensureSchema() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS postgis')
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id                SERIAL PRIMARY KEY,
      reporter_name     VARCHAR(120),
      reporter_contact  VARCHAR(120),
      description       TEXT NOT NULL,
      image_path        VARCHAR(500) NOT NULL,
      category          VARCHAR(64),
      confidence        REAL,
      bbox              JSONB,
      ml_mode           VARCHAR(16),
      status            VARCHAR(32) NOT NULL DEFAULT 'pending',
      priority          VARCHAR(16) NOT NULL DEFAULT 'medium',
      assigned_department VARCHAR(64),
      assigned_worker   VARCHAR(120),
      worker_notes      TEXT,
      completion_image  VARCHAR(500),
      resolved_at       TIMESTAMP,
      latitude          DOUBLE PRECISION NOT NULL,
      longitude         DOUBLE PRECISION NOT NULL,
      created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `)
  // Add new columns to existing tables (safe to run on old DBs)
  const cols = [
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS priority VARCHAR(16) NOT NULL DEFAULT 'medium'`,
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS assigned_worker VARCHAR(120)`,
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS worker_notes TEXT`,
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS completion_image VARCHAR(500)`,
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP`,
  ]
  for (const sql of cols) {
    await pool.query(sql).catch(() => {}) // ignore if already exists
  }
  await pool.query(`CREATE INDEX IF NOT EXISTS reports_status_idx   ON reports (status)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS reports_category_idx ON reports (category)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS reports_worker_idx   ON reports (assigned_worker)`)
  console.log('[db] schema ready')
}

// --- Redis queue (BullMQ producer) ----------------------------------------
const redisConnection = { host: REDIS_HOST, port: Number(REDIS_PORT) }
const mlQueue = new Queue('ml-inference', { connection: redisConnection })

// --- Express setup --------------------------------------------------------
const app = express()
app.use(cors())
app.use(express.json())

fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg'
      cb(null, `${crypto.randomBytes(12).toString('hex')}${ext}`)
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(jpg|jpeg|png|webp)$/i.test(file.originalname)
    cb(ok ? null : new Error('Only JPG/PNG/WEBP allowed'), ok)
  },
})

// --- Routes ---------------------------------------------------------------

app.get('/', (req, res) => res.json({ service: 'smart-city-backend', status: 'ok' }))

// Auth — login
const USERS = {
  admin:  { password: 'admin123',  role: 'admin',  name: 'Admin User'   },
  hamza:  { password: 'hamza123',  role: 'admin',  name: 'Hamza'        },
  ahmed:  { password: 'ahmed123',  role: 'worker', name: 'Ahmed Khan'   },
  sara:   { password: 'sara123',   role: 'worker', name: 'Sara Malik'   },
  usman:  { password: 'usman123',  role: 'worker', name: 'Usman Ali'    },
  fatima: { password: 'fatima123', role: 'worker', name: 'Fatima Raza'  },
  bilal:  { password: 'bilal123',  role: 'worker', name: 'Bilal Chaudhry' },
}

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required' })

  const user = USERS[username.toLowerCase()]
  if (!user || user.password !== password)
    return res.status(401).json({ error: 'Invalid username or password' })

  const token = Buffer.from(`${username}:${Date.now()}:${user.role}`).toString('base64')
  res.json({ token, role: user.role, name: user.name, username: username.toLowerCase() })
})

// Auth — register new user (in-memory for demo; in production use a DB)
const REGISTERED_USERS = {}
app.post('/api/auth/register', (req, res) => {
  const { username, name, password, role, email } = req.body || {}
  if (!username || !name || !password)
    return res.status(400).json({ error: 'Username, name, and password are required' })
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' })

  const key = username.toLowerCase().trim()
  if (!/^[a-z0-9_]+$/.test(key))
    return res.status(400).json({ error: 'Username may only contain letters, numbers, and underscores' })
  if (USERS[key] || REGISTERED_USERS[key])
    return res.status(409).json({ error: 'Username already taken' })

  const userRole = role === 'admin' ? 'admin' : 'worker'
  REGISTERED_USERS[key] = { password, role: userRole, name: name.trim(), email: email || null }

  const token = Buffer.from(`${key}:${Date.now()}:${userRole}`).toString('base64')
  res.status(201).json({ token, role: userRole, name: name.trim(), username: key })
})

// Submit a new report
app.post('/api/report', upload.single('image'), async (req, res) => {
  try {
    const { reporterName, reporterContact, description, latitude, longitude } = req.body
    if (!req.file)
      return res.status(400).json({ error: 'Image is required' })
    const lat = Number(latitude)
    const lng = Number(longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng))
      return res.status(400).json({ error: 'Valid latitude and longitude required' })

    // description is optional — AI will classify from the image
    const desc = description && description.trim().length >= 1
      ? description.trim()
      : 'AI classification pending'

    const imagePath = path.join(UPLOADS_DIR, req.file.filename)
    const { rows } = await pool.query(
      `INSERT INTO reports (reporter_name, reporter_contact, description, image_path, latitude, longitude, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING id, status`,
      [reporterName || null, reporterContact || null, desc, imagePath, lat, lng]
    )
    await mlQueue.add('classify', { reportId: rows[0].id, imagePath })
    res.status(201).json({ id: rows[0].id, status: rows[0].status, message: 'Report received.' })
  } catch (err) {
    console.error('[POST /api/report]', err)
    res.status(500).json({ error: err.message })
  }
})

// List reports (supports ?worker= filter for field workers)
app.get('/api/reports', async (req, res) => {
  try {
    const { status, category, worker } = req.query
    const conditions = []
    const params = []
    if (status)   { conditions.push(`status = $${params.length + 1}`);           params.push(status)   }
    if (category) { conditions.push(`category = $${params.length + 1}`);         params.push(category) }
    if (worker)   { conditions.push(`assigned_worker = $${params.length + 1}`);  params.push(worker)   }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows } = await pool.query(
      `SELECT * FROM reports ${where} ORDER BY created_at DESC LIMIT 500`,
      params
    )
    res.json(rows.map(mapReport))
  } catch (err) {
    console.error('[GET /api/reports]', err)
    res.status(500).json({ error: err.message })
  }
})

// Single report
app.get('/api/reports/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM reports WHERE id = $1', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(mapReport(rows[0]))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Admin update (status, assignedWorker, assignedDepartment, priority, category)
app.patch('/api/reports/:id', async (req, res) => {
  try {
    const { status, assignedDepartment, assignedWorker, priority, category } = req.body
    const updates = []
    const params = []

    const set = (col, val) => { updates.push(`${col} = $${params.length + 1}`); params.push(val) }

    if (status !== undefined)             set('status', status)
    if (assignedDepartment !== undefined) set('assigned_department', assignedDepartment)
    if (assignedWorker !== undefined)     set('assigned_worker', assignedWorker)
    if (priority !== undefined)           set('priority', priority)
    if (category !== undefined)           set('category', category)

    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' })

    // Set resolved_at when status flips to resolved
    if (status === 'resolved') { updates.push(`resolved_at = $${params.length + 1}`); params.push(new Date()) }

    updates.push('updated_at = NOW()')
    params.push(req.params.id)

    const { rows } = await pool.query(
      `UPDATE reports SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(mapReport(rows[0]))
  } catch (err) {
    console.error('[PATCH /api/reports/:id]', err)
    res.status(500).json({ error: err.message })
  }
})

// Field worker — mark complete (notes + optional photo)
app.post('/api/reports/:id/complete', upload.single('completionImage'), async (req, res) => {
  try {
    const { workerNotes } = req.body
    const completionImage = req.file ? path.join(UPLOADS_DIR, req.file.filename) : null
    const { rows } = await pool.query(
      `UPDATE reports
       SET status = 'resolved', worker_notes = $1, completion_image = $2,
           resolved_at = NOW(), updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [workerNotes || null, completionImage, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(mapReport(rows[0]))
  } catch (err) {
    console.error('[POST /api/reports/:id/complete]', err)
    res.status(500).json({ error: err.message })
  }
})

// Analytics endpoint
app.get('/api/analytics', async (req, res) => {
  try {
    const [totalsRes, trendRes, catRes, workerRes, resTimeRes] = await Promise.all([
      // Totals by status
      pool.query(`
        SELECT
          COUNT(*)                                          AS total,
          COUNT(*) FILTER (WHERE status = 'pending')       AS pending,
          COUNT(*) FILTER (WHERE status = 'reviewed')      AS reviewed,
          COUNT(*) FILTER (WHERE status = 'assigned')      AS assigned,
          COUNT(*) FILTER (WHERE status = 'in_progress')   AS in_progress,
          COUNT(*) FILTER (WHERE status = 'resolved')      AS resolved
        FROM reports
      `),
      // Reports per day — last 7 days
      pool.query(`
        SELECT
          date_trunc('day', created_at AT TIME ZONE 'UTC') AS day,
          COUNT(*) AS count
        FROM reports
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY day
        ORDER BY day
      `),
      // By category
      pool.query(`
        SELECT
          category,
          COUNT(*)          AS count,
          AVG(confidence)   AS avg_confidence
        FROM reports
        WHERE category IS NOT NULL
        GROUP BY category
        ORDER BY count DESC
      `),
      // Worker stats
      pool.query(`
        SELECT
          assigned_worker                                             AS name,
          COUNT(*) FILTER (WHERE status IN ('assigned','in_progress')) AS active,
          COUNT(*) FILTER (WHERE status = 'resolved')                  AS completed
        FROM reports
        WHERE assigned_worker IS NOT NULL
        GROUP BY assigned_worker
        ORDER BY completed DESC
      `),
      // Average resolution time in hours
      pool.query(`
        SELECT
          ROUND(
            AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric, 1
          ) AS avg_hours
        FROM reports
        WHERE status = 'resolved' AND resolved_at IS NOT NULL
      `),
    ])

    res.json({
      totals:             totalsRes.rows[0],
      trend:              trendRes.rows,
      byCategory:         catRes.rows,
      workerStats:        workerRes.rows,
      avgResolutionHours: resTimeRes.rows[0]?.avg_hours ?? null,
    })
  } catch (err) {
    console.error('[GET /api/analytics]', err)
    res.status(500).json({ error: err.message })
  }
})

// Serve uploaded images
app.use('/uploads', express.static(UPLOADS_DIR))

// Helper: DB row (snake_case) → API (camelCase)
function mapReport(r) {
  return {
    id:                 r.id,
    reporterName:       r.reporter_name,
    reporterContact:    r.reporter_contact,
    description:        r.description,
    imagePath:          r.image_path,
    category:           r.category,
    confidence:         r.confidence,
    bbox:               r.bbox,
    mlMode:             r.ml_mode,
    status:             r.status,
    priority:           r.priority ?? 'medium',
    assignedDepartment: r.assigned_department,
    assignedWorker:     r.assigned_worker,
    workerNotes:        r.worker_notes,
    latitude:           r.latitude,
    longitude:          r.longitude,
    createdAt:          r.created_at,
    updatedAt:          r.updated_at,
  }
}

// --- Startup --------------------------------------------------------------
async function start() {
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      await ensureSchema()
      app.listen(PORT, HOST, () => console.log(`[server] listening on ${HOST}:${PORT}`))
      return
    } catch (err) {
      console.log(`[startup] attempt ${attempt}/15 failed: ${err.code || err.message}. Retrying in 3s…`)
      await new Promise(r => setTimeout(r, 3000))
    }
  }
  process.exit(1)
}

start()
