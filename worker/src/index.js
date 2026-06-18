/**
 * BullMQ worker for ML inference.
 *
 * Flow:
 *   1. Pull job { reportId, imagePath } from "ml-inference" queue.
 *   2. Read image from disk, POST it to ML service /predict.
 *   3. Take top prediction → UPDATE reports row with category/confidence/bbox/status.
 *
 * Kept dependency-light on purpose: a raw pg client, no ORM. The schema is owned
 * by the backend's Lucid migrations.
 */
import { Worker } from 'bullmq'
import IORedis from 'ioredis'
import pg from 'pg'
import fs from 'node:fs'
import FormData from 'form-data'
import fetch from 'node-fetch'

const {
  REDIS_HOST = 'redis',
  REDIS_PORT = '6379',
  DB_HOST = 'postgres',
  DB_PORT = '5432',
  DB_USER = 'smartcity',
  DB_PASSWORD = 'smartcity',
  DB_DATABASE = 'smartcity',
  ML_SERVICE_URL = 'http://ml_service:8000',
} = process.env

const connection = new IORedis({
  host: REDIS_HOST,
  port: Number(REDIS_PORT),
  maxRetriesPerRequest: null,
})

const pool = new pg.Pool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_DATABASE,
})

async function classify(job) {
  const { reportId, imagePath } = job.data
  console.log(`[worker] job ${job.id} → report ${reportId}`)

  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image not found: ${imagePath}`)
  }

  const form = new FormData()
  form.append('file', fs.createReadStream(imagePath))

  const res = await fetch(`${ML_SERVICE_URL}/predict`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  })
  if (!res.ok) {
    throw new Error(`ML service ${res.status}: ${await res.text()}`)
  }

  const result = await res.json()
  const top = result.predictions[0]
  if (!top) {
    // No detections — leave category null, mark as reviewed so admin can triage.
    await pool.query(
      `UPDATE reports SET status='reviewed', ml_mode=$1, updated_at=NOW() WHERE id=$2`,
      [result.mode, reportId]
    )
    return { ok: true, detections: 0 }
  }

  await pool.query(
    `UPDATE reports
       SET category=$1, confidence=$2, bbox=$3, ml_mode=$4,
           status='reviewed', updated_at=NOW()
       WHERE id=$5`,
    [top.category, top.confidence, JSON.stringify(top.bbox), result.mode, reportId]
  )
  console.log(`[worker] report ${reportId} → ${top.category} (${top.confidence})`)
  return { ok: true, category: top.category, confidence: top.confidence }
}

const worker = new Worker('ml-inference', classify, {
  connection,
  concurrency: 4,
})

worker.on('failed', (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err.message)
})

console.log('[worker] ready — listening on queue "ml-inference"')
