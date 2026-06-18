"""
Test trained model on one image from each class folder.
"""
from ultralytics import YOLO
import os

model = YOLO('ml_service/weights/best.pt')

test_folders = {
    'Pothole':         'data/raw_dataset/pothole/images',
    'Traffic_Light':   'data/raw_dataset/traffic_lights/images',
    'Waste_Container': 'data/raw_dataset/waste_container/images',
}

print("="*60)
print(f"Model classes: {model.names}")
print("="*60)

for expected_class, folder in test_folders.items():
    images = [f for f in os.listdir(folder) if f.endswith('.jpg')]
    if not images:
        print(f"\n❌ No images in {folder}")
        continue
    
    test_image = os.path.join(folder, images[0])
    print(f"\n📷 Testing {expected_class} (image: {images[0]})")
    
    results = model.predict(test_image, conf=0.4, verbose=False)
    
    if len(results[0].boxes) == 0:
        print(f"   ❌ No detections")
    else:
        for i, box in enumerate(results[0].boxes):
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            cls_name = model.names[cls_id]
            status = "✓" if cls_name == expected_class else "⚠ wrong class"
            print(f"   {status} Detected: {cls_name} ({conf:.1%})")

print("\n" + "="*60)
print("Done!")