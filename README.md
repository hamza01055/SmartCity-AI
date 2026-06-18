# SmartCity — AI-Powered Urban Issue Detection & Management Platform

> **Final Year Project** · BSCS · Hamza Shahzad · [hamza01055](https://github.com/hamza01055)

An end-to-end web platform that lets citizens report urban infrastructure problems (potholes, garbage, broken streetlights) by uploading a photo and sharing their GPS location. A YOLOv8 computer-vision model automatically classifies the issue, and city administrators manage the full workflow — from triage to field-worker dispatch — through a live map dashboard.

---

## Live Architecture

```
  Citizen / Field Worker (React + Tailwind)
          |
          |  POST /api/report  (photo + GPS)
          v
  Backend (Node.js / Express)
          |─── PostgreSQL + PostGIS  (reports, geo-queries)
          |─── Redis / BullMQ        (inference job queue)
          |
          |  enqueue job
          v
  ML Worker (Node.js BullMQ consumer)
          |
          |  POST /predict
          v
  ML Service (Python / FastAPI / YOLOv8)
          |
          |  category + confidence + bounding box
          v
  Report updated → Admin Dashboard (live map, analytics, dispatch)
```

---

## Key Features

### Citizen Portal
| Feature | Detail |
|---------|--------|
| Photo upload | Drag-drop or camera capture (HEIC/JPG/PNG/WEBP, max 10 MB) |
| GPS auto-detect | One-click browser geolocation; crews dispatched to exact coords |
| AI classification | No description needed — YOLOv8 reads the photo automatically |
| Status tracking | Real-time 5-step progress tracker by report ID |

### Admin Dashboard
| Feature | Detail |
|---------|--------|
| Live map | Leaflet map, reports color-coded by category |
| Assign & dispatch | Set worker, department, priority (high/medium/low) from a side panel |
| Filter & export | Filter by category or status; one-click CSV export |
| KPI cards | Total / Pending / Reviewed / Assigned / Resolved at a glance |

### Analytics Page
| Feature | Detail |
|---------|--------|
| Trend chart | Reports per day for the last 7 days |
| Category breakdown | Bar chart by issue type with AI confidence |
| Heatmap | Leaflet heatmap of report hot-spots |
| Worker leaderboard | Completed vs active tasks per field worker |
| Avg resolution time | Mean hours from submission to resolution |

### Field Worker Portal
| Feature | Detail |
|---------|--------|
| Personal task list | Shows only tasks assigned to the logged-in worker |
| Status advancement | Advance through Assigned → In Progress → Resolved |
| Completion panel | Submit notes + optional completion photo |

### Auth System
| Feature | Detail |
|---------|--------|
| Login page | Professional two-column layout, demo credential quick-fill |
| Registration | Full-name, username, password-strength meter, role selection |
| Offline fallback | Works without backend using localStorage credential store |
| Session persistence | Auth state survives page refresh via localStorage |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS v3 |
| **UI Style** | Dark cyberpunk / glassmorphism — custom Tailwind color tokens |
| **Maps** | React-Leaflet, OpenStreetMap tiles, CircleMarker heat overlays |
| **Forms** | Formik + Yup validation |
| **Backend** | Node.js 20, Express 4, Multer (file uploads) |
| **Queue** | Redis + BullMQ (producer in backend, consumer in worker) |
| **Database** | PostgreSQL 15 + PostGIS extension |
| **ML Service** | Python 3.11, FastAPI, Ultralytics YOLOv8 |
| **Model** | YOLOv8m — custom-trained on 3 urban classes |
| **Deployment** | Docker Compose (6 containers) |

---

## Machine Learning Model

The detection model is a **YOLOv8m** network trained on a custom dataset of ~1,500 labeled images across three classes:

| Class | Description |
|-------|-------------|
| `Pothole` | Damaged road surfaces |
| `Traffic_Light` | Traffic signal infrastructure |
| `Waste_Container` | Garbage bins and accumulation |

Training was run for **100 epochs** on a Google Colab T4 GPU.

### Validation Results

| Metric | Score |
|--------|-------|
| mAP@50 | 0.73 |
| mAP@50–95 | 0.41 |
| Precision | 0.82 |
| Recall | 0.70 |

The trained weights are at `ml_service/weights/best.pt`. The FastAPI service loads them on startup and exposes a `/predict` endpoint that accepts an image and returns predictions with category, confidence, and bounding-box coordinates.

To retrain or add new classes (e.g. flooding, fire), use `notebooks/yolov8_training.ipynb`, then drop the new `best.pt` into `ml_service/weights/` and restart the ML service container.

---

## Project Structure

```
smart-city-project/
├── frontend/                  React + TypeScript app
│   └── src/
│       ├── pages/
│       │   ├── LoginPage.tsx       Sign-in with demo credential quick-fill
│       │   ├── RegisterPage.tsx    Account creation with password strength meter
│       │   ├── ReportPage.tsx      Citizen photo + GPS submission form
│       │   ├── StatusPage.tsx      5-step progress tracker by report ID
│       │   ├── DashboardPage.tsx   Admin map, filters, dispatch panel, CSV export
│       │   ├── AnalyticsPage.tsx   KPIs, trend chart, heatmap, worker leaderboard
│       │   └── FieldWorkerPage.tsx Task list, status advancement, completion panel
│       ├── components/
│       │   └── SmartCityHero.tsx   Canvas 3D animated city (HTML5, mouse-reactive)
│       ├── contexts/
│       │   └── AuthContext.tsx     Auth state, localStorage persistence, register()
│       └── lib/
│           └── api.ts              Axios client, Report type, color maps
│
├── backend/                   Express API + BullMQ producer
│   └── src/index.js
│       ├── POST /api/auth/login      Sign in (7 demo users + registered users)
│       ├── POST /api/auth/register   Create account (in-memory + DB)
│       ├── POST /api/report          Submit report, enqueue ML job
│       ├── GET  /api/reports         List with status/category/worker filters
│       ├── GET  /api/reports/:id     Single report
│       ├── PATCH /api/reports/:id    Admin update (status, worker, priority, dept)
│       ├── POST /api/reports/:id/complete  Field worker completion with photo
│       └── GET  /api/analytics       5 parallel SQL queries → KPIs + trends
│
├── ml_service/                FastAPI + YOLOv8 inference
│   ├── app/main.py            POST /predict endpoint
│   └── weights/best.pt        Trained YOLOv8m weights
│
├── worker/                    BullMQ consumer: dequeues jobs, calls ML, updates DB
│
├── notebooks/
│   └── yolov8_training.ipynb  Colab training notebook
│
├── prepare_dataset.py         Dataset cleaning + YOLO train/val split
├── docker-compose.yml
└── .env                       Environment configuration
```

---

## Running the Project

### Prerequisites
- Docker Desktop (running)
- Trained model at `ml_service/weights/best.pt`

### Start all services

```bash
docker compose up --build
```

Six containers start: `postgres`, `redis`, `ml_service`, `backend`, `worker`, `frontend`.

| URL | Service |
|-----|---------|
| http://localhost:5173 | Citizen & Admin app |
| http://localhost:5173/admin | Admin dashboard |
| http://localhost:5173/analytics | Analytics |
| http://localhost:3333 | Backend REST API |
| http://localhost:8000/docs | ML service Swagger UI |

### Development (without Docker)

```bash
# Terminal 1 — Frontend
cd frontend && npm install && npm run dev

# Terminal 2 — Backend (requires Postgres + Redis running)
cd backend && npm install && npm run dev

# Terminal 3 — ML service (requires Python + weights)
cd ml_service && pip install -r requirements.txt && uvicorn app.main:app --reload
```

---

## Demo Accounts

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Admin |
| `hamza` | `hamza123` | Admin |
| `ahmed` | `ahmed123` | Field Worker |
| `sara` | `sara123` | Field Worker |
| `usman` | `usman123` | Field Worker |

Or create a new account via the **Register** page — works offline via localStorage.

---

## Environment Configuration

```env
# Backend (Docker service names for inter-container networking)
DB_HOST=postgres
DB_PORT=5432
DB_USER=smartcity
DB_PASSWORD=smartcity
DB_DATABASE=smartcity

REDIS_HOST=redis
REDIS_PORT=6379

ML_SERVICE_URL=http://ml_service:8000
USE_REAL_MODEL=true
MODEL_PATH=/app/weights/best.pt

# Frontend (browser-visible, must use localhost)
VITE_API_URL=http://localhost:3333
```

---

## Screenshots

> _Add screenshots of the login page, report form, admin dashboard, and analytics page here._

---

## Future Work

- Real-time dashboard updates via WebSockets (currently polls every 6 s)
- JWT-based stateless authentication replacing the demo token
- Cloud deployment (AWS ECS / Railway / Render)
- Push notifications to field workers on new assignments
- Extended model classes: flooding, fire, illegal dumping, broken pavements
- Mobile-native app (React Native) for field workers

---

## Author

**Hamza Shahzad** · Final Year Project · BSCS  
GitHub: [hamza01055](https://github.com/hamza01055)  
Email: hamzashahzad454545@gmail.com
