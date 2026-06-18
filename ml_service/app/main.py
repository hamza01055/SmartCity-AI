"""
ML inference service for Smart City Issue Detection.

Three modes controlled by env vars:
- USE_REAL_MODEL=false (default): mock predictions for pipeline testing
- USE_REAL_MODEL=true + ROBOFLOW_API_KEY set: proxy to Roboflow hosted API
- USE_REAL_MODEL=true + MODEL_PATH set: load local YOLOv8 weights (best.pt)
"""
import os
import random
import base64
from io import BytesIO
from typing import List

import requests
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

USE_REAL_MODEL = os.getenv("USE_REAL_MODEL", "false").lower() == "true"
MODEL_PATH = os.getenv("MODEL_PATH", "/app/weights/best.pt")

# Roboflow hosted inference (set these if using Rapid's hosted API)
ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY", "")
ROBOFLOW_MODEL = os.getenv("ROBOFLOW_MODEL", "")  # e.g. "your-workspace/pothole-detector/1"

CLASS_NAMES = ["Pothole", "Garbage", "Broken Streetlight"]

app = FastAPI(title="Smart City ML Service", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_model = None


def get_model():
    global _model
    if _model is None and USE_REAL_MODEL and not ROBOFLOW_API_KEY:
        from ultralytics import YOLO
        if not os.path.exists(MODEL_PATH):
            raise RuntimeError(
                f"USE_REAL_MODEL=true but no weights found at {MODEL_PATH} "
                f"and no ROBOFLOW_API_KEY set."
            )
        _model = YOLO(MODEL_PATH)
    return _model


class BoundingBox(BaseModel):
    x: float
    y: float
    w: float
    h: float


class Prediction(BaseModel):
    category: str
    confidence: float
    bbox: BoundingBox


class PredictResponse(BaseModel):
    mode: str
    predictions: List[Prediction]
    image_width: int
    image_height: int


@app.get("/")
def root():
    return {"service": "smart-city-ml", "status": "ok"}


@app.get("/health")
def health():
    mode = "mock"
    if USE_REAL_MODEL:
        mode = "roboflow" if ROBOFLOW_API_KEY else "local"
    return {"status": "ok", "mode": mode, "model_loaded": _model is not None}


@app.post("/predict", response_model=PredictResponse)
async def predict(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        img = Image.open(BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    width, height = img.size

    if not USE_REAL_MODEL:
        return _mock_predict(width, height)
    if ROBOFLOW_API_KEY and ROBOFLOW_MODEL:
        return _roboflow_predict(contents, width, height)
    return _local_predict(img, width, height)


def _mock_predict(width: int, height: int) -> PredictResponse:
    category = random.choice(CLASS_NAMES)
    confidence = round(random.uniform(0.72, 0.97), 3)
    bbox = BoundingBox(
        x=round(random.uniform(0.1, 0.4), 3),
        y=round(random.uniform(0.1, 0.4), 3),
        w=round(random.uniform(0.2, 0.5), 3),
        h=round(random.uniform(0.2, 0.5), 3),
    )
    return PredictResponse(
        mode="mock",
        predictions=[Prediction(category=category, confidence=confidence, bbox=bbox)],
        image_width=width,
        image_height=height,
    )


def _roboflow_predict(contents: bytes, width: int, height: int) -> PredictResponse:
    """Call Roboflow's hosted inference API."""
    url = f"https://detect.roboflow.com/{ROBOFLOW_MODEL}"
    b64 = base64.b64encode(contents).decode("utf-8")
    try:
        r = requests.post(
            url,
            params={"api_key": ROBOFLOW_API_KEY},
            data=b64,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15,
        )
        r.raise_for_status()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Roboflow API error: {e}")

    data = r.json()
    preds: List[Prediction] = []
    for p in data.get("predictions", []):
        # Roboflow returns center-x, center-y, width, height in pixels
        cx, cy, w, h = p["x"], p["y"], p["width"], p["height"]
        x1, y1 = cx - w / 2, cy - h / 2
        preds.append(Prediction(
            category="Pothole",  # normalize class name regardless of Rapid's casing
            confidence=round(p["confidence"], 3),
            bbox=BoundingBox(
                x=round(x1 / width, 3),
                y=round(y1 / height, 3),
                w=round(w / width, 3),
                h=round(h / height, 3),
            ),
        ))
    return PredictResponse(
        mode="roboflow",
        predictions=preds,
        image_width=width,
        image_height=height,
    )


def _local_predict(img: Image.Image, width: int, height: int) -> PredictResponse:
    model = get_model()
    results = model.predict(img, verbose=False)
    preds: List[Prediction] = []
    for r in results:
        for box in r.boxes:
            cls_idx = int(box.cls[0])
            conf = float(box.conf[0])
            x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
            category = CLASS_NAMES[cls_idx] if cls_idx < len(CLASS_NAMES) else CLASS_NAMES[0]
            preds.append(Prediction(
                category=category,
                confidence=round(conf, 3),
                bbox=BoundingBox(
                    x=round(x1 / width, 3),
                    y=round(y1 / height, 3),
                    w=round((x2 - x1) / width, 3),
                    h=round((y2 - y1) / height, 3),
                ),
            ))
    return PredictResponse(
        mode="local",
        predictions=preds,
        image_width=width,
        image_height=height,
    )
