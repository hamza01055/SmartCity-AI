<div align="center">

# 🏙️ SmartCity — AI-Powered Urban Issue Detection & Reporting System

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python)](https://python.org/)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-FF6B35?style=flat-square)](https://ultralytics.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)](https://docker.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat-square&logo=postgresql)](https://postgresql.org/)

**Final Year Project · BSCS · Hamza Shahzad**

*An end-to-end platform where citizens report urban issues via photo & GPS, and a YOLOv8 AI model automatically classifies them for city administrators.*

[Features](#-features) · [Screenshots](#-screenshots) · [Architecture](#-architecture) · [Tech Stack](#-tech-stack) · [ML Model](#-machine-learning-model) · [Getting Started](#-getting-started) · [Demo](#-demo-accounts)

</div>

---

## 📋 Overview

SmartCity eliminates the slow, manual complaint process in municipal systems. A citizen snaps a photo of a pothole, broken traffic light, or overflowing garbage bin — the system automatically detects and categorizes the issue using computer vision, then routes it to the appropriate city department within seconds.

### The Problem
Traditional municipal complaint systems are slow: a citizen files a complaint → someone reads it → someone categorizes it → someone routes it. This project **automates the detection and categorization step**, so a report is classified the moment it is submitted.

### The Solution
- 📸 Citizen uploads a photo + GPS location
- 🤖 YOLOv8 AI instantly classifies the issue
- 🗺️ Admin sees it on a live map dashboard
- 👷 Field worker gets assigned and resolves it

---

## 📸 Screenshots

### 🏠 Citizen Report Page
![Report Page](screenshots/screenshot1_report.png)
> Citizens upload a photo and share GPS location. YOLOv8 AI automatically detects and classifies the urban issue.

---

### 🔍 Track Report — Search
![Track Page](screenshots/screenshot2_track.png)
> Citizens can track their submitted report using a unique tracking ID.

---

### ✅ Track Report — Status View
![Status View](screenshots/screenshot3_status.png)
> Real-time 5-step progress tracker showing AI confidence score, category, location, and assigned worker.

---

### 👷 Field Worker Portal
![Field Worker Portal](screenshots/screenshot4_worker.png)
> Field workers select their name to view only their assigned tasks and update status.

---

### 🖥️ Admin Dashboard
![Admin Dashboard](screenshots/screenshot5_admin.png)
> Live map with color-coded report markers, KPI cards (31 total, 20 reviewed, 7 resolved), and report management table with CSV export.

---

### 📊 Analytics Page
![Analytics Page](screenshots/screenshot6_analytics.png)
> Comprehensive analytics with trend charts, category breakdown, AI confidence scores, worker performance, issue heatmap, and worker leaderboard.

---

## ✨ Features

### 🧑‍💻 Citizen Portal
| Feature | Description |
|---------|-------------|
| Photo Upload | Drag-drop or camera capture (HEIC/JPG/PNG/WEBP, max 10 MB) |
| GPS Auto-detect | One-click browser geolocation |
| AI Classification | No description needed — YOLOv8 reads the photo automatically |
| Status Tracking | Real-time 5-step progress tracker by report ID |

### 🖥️ Admin Dashboard
| Feature | Description |
|---------|-------------|
| Live Map | Leaflet map with reports color-coded by category |
| Assign & Dispatch | Set worker, department, and priority from a side panel |
| Filter & Export | Filter by category/status; one-click CSV export |
| KPI Cards | Total / Pending / Reviewed / Assigned / Resolved at a glance |

### 📊 Analytics Page
| Feature | Description |
|---------|-------------|
| Trend Chart | Reports per day for the last 7 days |
| Category Breakdown | Bar chart by issue type with AI confidence scores |
| Heatmap | Leaflet heatmap of report hot-spots |
| Worker Leaderboard | Completed vs active tasks per field worker |
| Avg Resolution Time | Mean hours from submission to resolution |

### 👷 Field Worker Portal
| Feature | Description |
|---------|-------------|
| Personal Task List | Shows only tasks assigned to the logged-in worker |
| Status Advancement | Advance through Assigned → In Progress → Resolved |
| Completion Panel | Submit notes + optional completion photo |

### 🔐 Auth System
| Feature | Description |
|---------|-------------|
| Login Page | Professional layout with demo credential quick-fill |
| Registration | Full-name, username, password-strength meter, role selection |
| Offline Fallback | Works without backend using localStorage credential store |
| Session Persistence | Auth state survives page refresh |

---

## 🏗️ Architecture

```
  Citizen / Field Worker
    (React + Tailwind)
          │
          │  POST /api/report  (photo + GPS)
          ▼
  ┌─────────────────────┐
  │  Backend            │──── PostgreSQL + PostGIS  (reports, geo-queries)
  │  (Node.js/Express)  │──── Redis / BullMQ        (inference job queue)
  └─────────────────────┘
          │  enqueue job
          ▼
  ┌─────────────────────┐
  │  ML Worker          │
  │  (Node.js/BullMQ)   │
  └─────────────────────┘
          │  POST /predict
          ▼
  ┌─────────────────────┐
  │  ML Service         │──── category + confidence + bounding box
  │  (FastAPI/YOLOv8)   │
  └─────────────────────┘
          │
          ▼
  Report Updated → Admin Dashboard
  (Live map · Analytics · Dispatch)
```

---

## 🛠️ Tech Stack

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

## 🤖 Machine Learning Model

The detection model is a **YOLOv8m** network trained on a custom dataset of ~1,500 labeled images across three urban issue classes:

| Class | Description |
|-------|-------------|
| `Pothole` | Damaged road surfaces |
| `Traffic_Light` | Traffic signal infrastructure |
| `Waste_Container` | Garbage bins and waste accumulation |

**Training:** 100 epochs on Google Colab T4 GPU

### Validation Results

| Metric | Score |
|--------|-------|
| mAP@50 | **0.73** |
| mAP@50–95 | 0.41 |
| Precision | **0.82** |
| Recall | 0.70 |

> To retrain or add new classes, use `notebooks/yolov8_training.ipynb`, then replace `best.pt` in `ml_service/weights/` and restart the ML container.

---

## 📁 Project Structure

```
smart-city-project/
├── frontend/                        React + TypeScript app
│   └── src/
│       ├── pages/
│       │   ├── LoginPage.tsx        Sign-in with demo credential quick-fill
│       │   ├── RegisterPage.tsx     Account creation with password strength meter
│       │   ├── ReportPage.tsx       Citizen photo + GPS submission form
│       │   ├── StatusPage.tsx       5-step progress tracker by report ID
│       │   ├── DashboardPage.tsx    Admin map, filters, dispatch panel, CSV export
│       │   ├── AnalyticsPage.tsx    KPIs, trend chart, heatmap, worker leaderboard
│       │   └── FieldWorkerPage.tsx  Task list, status advancement, completion panel
│       ├── components/
│       │   └── SmartCityHero.tsx    Canvas 3D animated city (HTML5, mouse-reactive)
│       ├── contexts/
│       │   └── AuthContext.tsx      Auth state, localStorage persistence
│       └── lib/
│           └── api.ts               Axios client, Report type, color maps
│
├── backend/                         Express API + BullMQ producer
├── ml_service/                      FastAPI + YOLOv8 inference
│   ├── app/main.py                  POST /predict endpoint
│   └── weights/best.pt              Trained YOLOv8m weights
├── worker/                          BullMQ consumer → calls ML → updates DB
├── notebooks/
│   └── yolov8_training.ipynb        Colab training notebook
├── screenshots/                     App screenshots
├── prepare_dataset.py               Dataset cleaning + YOLO train/val split
├── docker-compose.yml
└── .env.example                     Environment configuration template
```

---

## 🚀 Getting Started

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Trained model at `ml_service/weights/best.pt`

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/hamza01055/SMART-CITY-REPORTING-SYSTEM.git
cd SMART-CITY-REPORTING-SYSTEM

# Copy environment file
cp .env.example .env

# Start all 6 containers
docker compose up --build
```

| URL | Service |
|-----|---------|
| http://localhost:5173 | Citizen & Admin App |
| http://localhost:5173/admin | Admin Dashboard |
| http://localhost:5173/analytics | Analytics Page |
| http://localhost:3333 | Backend REST API |
| http://localhost:8000/docs | ML Service Swagger UI |

### Option 2: Manual (Without Docker)

```bash
# Terminal 1 — Frontend
cd frontend && npm install && npm run dev

# Terminal 2 — Backend
cd backend && npm install && npm run dev

# Terminal 3 — ML Service
cd ml_service && pip install -r requirements.txt
uvicorn app.main:app --reload

# Terminal 4 — Worker
cd worker && npm install && npm run dev
```

---

## ⚙️ Environment Configuration

```env
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

VITE_API_URL=http://localhost:3333
```

> ⚠️ **Never commit your `.env` file.** Use `.env.example` as a template.

---

## 👥 Demo Accounts

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Admin |
| `hamza` | `hamza123` | Admin |
| `ahmed` | `ahmed123` | Field Worker |
| `sara` | `sara123` | Field Worker |
| `usman` | `usman123` | Field Worker |

---

## 🔮 Future Work

- [ ] Real-time dashboard updates via WebSockets
- [ ] JWT-based stateless authentication
- [ ] Cloud deployment (AWS ECS / Railway / Render)
- [ ] Push notifications to field workers
- [ ] Extended model classes: flooding, fire, illegal dumping
- [ ] Mobile-native app (React Native) for field workers

---

## 👨‍💻 Author

<div align="center">

**Hamza Shahzad**  
Final Year Project · BSCS

[![GitHub](https://img.shields.io/badge/GitHub-hamza01055-181717?style=flat-square&logo=github)](https://github.com/hamza01055)
[![Email](https://img.shields.io/badge/Email-hamzashahzad454545@gmail.com-EA4335?style=flat-square&logo=gmail)](mailto:hamzashahzad454545@gmail.com)

</div>
