import uvicorn
from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect, Body, Request
import time
from fastapi.responses import JSONResponse
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from ultralytics import YOLO
from ultralytics.utils.plotting import Annotator, colors
from ultralytics.trackers import BYTETracker
from types import SimpleNamespace
import cv2
import numpy as np
import tempfile
import os
import base64
import imageio
import httpx
import torch
import gc
from typing import List, Dict, Any
from dotenv import load_dotenv
from pydantic import BaseModel, HttpUrl
# ==============================================================================
# 0. GLOBAL SETTINGS
# ==============================================================================
if torch.cuda.is_available():
    print("CUDA detected: Enabling full GPU performance", flush=True)
else:
    print("CPU only: Limiting threads to 1 to prevent blocking", flush=True)
    torch.set_num_threads(1)

# ==============================================================================
# 1. CONFIGURATION
# ==============================================================================
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=dotenv_path)

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")
COCO_DOG_CLASS_ID = 16 
# Các class động vật trong COCO: 15: Cat, 16: Dog, 17: Horse, 18: Sheep, 19: Cow, 21: Bear
ANIMAL_CLASSES = [15, 16, 17, 18, 19, 21]

class URLPayload(BaseModel):
    url: HttpUrl

class Config:
    def __init__(self):
        self.classify_model = None   # Model CHÍNH (V8s)
        self.detect_model = None     # Model PHỤ (V11n)
        self.device = "cpu"
        
        # Kết nối DB
        try:
            if MONGO_URI:
                self.mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
                self.db = self.mongo_client[DB_NAME]
                print("MongoDB connection successful", flush=True)
            else:
                self.db = None
        except Exception as e:
            print(f"MongoDB Error: {e}", flush=True)
            self.db = None

        self.load() 
        self._load_detector()

    def _load_detector(self):
        """Load model Nano nhẹ chỉ để tìm vị trí"""
        path = "models/yolo11n.pt"
        if not os.path.exists("models"): os.makedirs("models")
        try:
            self.detect_model = YOLO(path)
            self.detect_model.to(self.device)
            print(f"--> DETECTOR (yolo11n) loaded", flush=True)
        except Exception as e:
            print(f"Detector load failed: {e}. Will use Classify Model for detection.", flush=True)
            self.detect_model = None

    def load(self, config_data: dict = None):
        if config_data: 
            self._apply_config(config_data)
        else:
            full_config = {}
            if self.db is not None:
                try:
                    config_doc = self.db.configurations.find_one({"key": "model_thresholds"})
                    print(f"[CONFIG] Đọc từ DB (configurations): {config_doc}", flush=True)
                    model_doc = self.db.ai_models.find_one({"status": "ACTIVE", "taskType": "DOG_BREED_CLASSIFICATION"})
                    print(f"[CONFIG] Đọc từ DB (ai_models): {model_doc}", flush=True)

                    full_config = config_doc if config_doc else {}
                    if model_doc:
                        full_config["model_path"] = model_doc.get("fileName")
                        full_config["huggingface_repo"] = model_doc.get("huggingFaceRepo")
                except Exception as e:
                    print(f"[CONFIG] Lỗi khi đọc cấu hình từ DB: {e}", flush=True)

            print(f"[CONFIG] Tổng hợp cấu hình cuối cùng để áp dụng: {full_config}", flush=True)
            self._apply_config(full_config)

    def _apply_config(self, config_data: dict):
        print(f"[CONFIG] Bắt đầu áp dụng cấu hình: {config_data}", flush=True)
        
        # Cấu hình Detector (V11n)
        self.IMAGE_CONF = float(config_data.get("image_conf", 0.25)) # Chuẩn vàng YOLO
        self.VIDEO_CONF = float(config_data.get("video_conf", 0.25))
        self.STREAM_CONF = float(config_data.get("stream_conf", 0.25))
        
        self.CLASS_CONF = float(config_data.get("class_conf", 0.1)) 
        
        self.BREED_CONF_THRESHOLD = 0.45      
        self.OVERRIDE_CONF_THRESHOLD = 0.65 
        
        iou_val = config_data.get("iou", 0.45) 
        try:
            self.IOU = float(iou_val)
        except:
            self.IOU = 0.45

        self.device = config_data.get("device", "cpu")
        
        if "cuda" in self.device and not torch.cuda.is_available():
            print("CUDA is not available. Switching to CPU.", flush=True)
            self.device = "cpu"
        
        filename = os.path.basename(config_data.get("model_path") or "model_v8s_pro.pt")
        self.MODEL_PATH = os.path.join("models", filename)
        self.HUGGINGFACE_REPO = config_data.get("huggingface_repo", "HakuDevon/Dog_Breed_ID")
        
        print("--- [CONFIG] Giá trị đã áp dụng ---", flush=True)
        print(f"  - IMAGE_CONF (Detector): {self.IMAGE_CONF}", flush=True)
        print(f"  - CLASS_CONF (Classifier): {self.CLASS_CONF}", flush=True)
        print(f"  - BREED_CONF_THRESHOLD: {self.BREED_CONF_THRESHOLD}", flush=True)
        print(f"  - OVERRIDE_CONF_THRESHOLD: {self.OVERRIDE_CONF_THRESHOLD}", flush=True)
        print(f"  - IOU: {self.IOU}", flush=True)
        print(f"  - device: {self.device}", flush=True)
        print(f"  - MODEL_PATH: {self.MODEL_PATH}", flush=True)
        print("---------------------------------", flush=True)

        if not os.path.exists(os.path.dirname(self.MODEL_PATH)): os.makedirs(os.path.dirname(self.MODEL_PATH))
        if not os.path.exists(self.MODEL_PATH): self._download_model()
            
        self._load_classifier()

    def _load_classifier(self):
        try:
            print(f"--> Loading CLASSIFIER: {self.MODEL_PATH}...", flush=True)
            self.classify_model = YOLO(self.MODEL_PATH)
            
            if self.MODEL_PATH.endswith(".pt"):
                self.classify_model.to(self.device)
            
            self.classify_model(np.zeros((640, 640, 3), dtype=np.uint8), verbose=False) 
            print(f"CLASSIFIER loaded ({'ONNX' if self.MODEL_PATH.endswith('.onnx') else 'PyTorch'}).", flush=True)
        except Exception as e:
            print(f"Classify model error: {e}", flush=True)

    def _download_model(self):
        from huggingface_hub import hf_hub_download
        try: hf_hub_download(repo_id=self.HUGGINGFACE_REPO, filename=os.path.basename(self.MODEL_PATH), local_dir="models")
        except: pass

app = FastAPI(title="Dog Breed AI - Hybrid v12")
app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"]
)
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    print(f"[AI-API] Request received: {request.url.path}", flush=True)
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    print(f"[AI-API] Request processed: {request.url.path} - Duration: {process_time:.2f}ms", flush=True)
    response.headers["X-Process-Time"] = str(process_time)
    return response
config = None
@app.on_event("startup")
def startup_event():
    global config
    print("--- SERVER STARTING: Loading AI Models... ---")
    config = Config()
# ==============================================================================
# 2. LOGIC XỬ LÝ (CPU BOUND)
# ==============================================================================

def get_padded_crop(img, box, padding_pct=0.2): 
    x1, y1, x2, y2 = int(box[0]), int(box[1]), int(box[2]), int(box[3])
    h, w, _ = img.shape
    pad_w, pad_h = int((x2-x1)*padding_pct), int((y2-y1)*padding_pct)
    return img[max(0, y1-pad_h):min(h, y2+pad_h), max(0, x1-pad_w):min(w, x2+pad_w)]

def process_results(results, model) -> List[Dict[str, Any]]:
    dets = []
    if not results or not results[0].boxes: return dets
    boxes = results[0].boxes
    ids = boxes.id.int().cpu().tolist() if boxes.id is not None else [None]*len(boxes)
    
    for t_id, c_id, conf, xyxy in zip(ids, boxes.cls.int().cpu().tolist(), boxes.conf.float().cpu().tolist(), boxes.xyxy.cpu().tolist()):
        dets.append({
            "track_id": t_id,
            "class_id": c_id,
            "class": model.names[c_id],
            "confidence": conf,
            "box": [int(x) for x in xyxy]
        })
    return dets

def draw_annotations(img, dets):
    annotator = Annotator(img, line_width=2)
    for d in dets:
        label = f"{d['class']} {d['confidence']:.2f}"
        if d.get("track_id") is not None: label = f"ID:{d['track_id']} " + label
        annotator.box_label(d["box"], label, color=colors(int(d.get("track_id") or 0), True))
    return annotator.result()

def apply_nms(detections, iou_threshold=0.5):
    if not detections: return []
    dets = sorted(detections, key=lambda x: x['confidence'], reverse=True)
    keep = []
    while dets:
        best = dets.pop(0)
        keep.append(best)
        def get_iou(boxA, boxB):
            xA = max(boxA[0], boxB[0])
            yA = max(boxA[1], boxB[1])
            xB = min(boxA[2], boxB[2])
            yB = min(boxA[3], boxB[3])
            interArea = max(0, xB - xA) * max(0, yB - yA)
            boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
            boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
            unionArea = float(boxAArea + boxBArea - interArea)
            if unionArea == 0: return 0
            return interArea / unionArea
            
        dets = [d for d in dets if get_iou(best['box'], d['box']) < iou_threshold]
    return keep

# --- LOGIC ẢNH: Hybrid (Detect -> Classify -> Court Judgment) ---
def cpu_process_image(image_bytes: bytes) -> Dict[str, Any]:
    t_start = time.time()
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None: raise ValueError("Invalid image")

    # BƯỚC 1: DETECTOR (YOLOv11n) - "Thằng Bảo Vệ"
    t_detect_start = time.time()
    detector = config.detect_model if config.detect_model else config.classify_model
    # conf=0.25 (Chuẩn vàng), iou=0.45, classes=ANIMAL_CLASSES
    detect_res = detector(img, conf=config.IMAGE_CONF, iou=config.IOU, classes=ANIMAL_CLASSES, verbose=False) 
    base_objects = process_results(detect_res, detector)
    t_detect_end = time.time()

    final_results = []
    t_classify_start = time.time()

    for obj in base_objects:
        # BƯỚC 2: CLASSIFIER (YOLOv8s) - "Thằng Chuyên Gia"
        # Cắt ảnh (Crop)
        crop = get_padded_crop(img, obj["box"])
        
        if crop.size > 0:
            # Chạy suy luận với conf cực thấp (0.1) để lấy kết quả
            cls_res = config.classify_model(crop, conf=config.CLASS_CONF, verbose=False)
            cls_dets = process_results(cls_res, config.classify_model)
            
            # BƯỚC 3: TÒA ÁN PHÁN QUYẾT (Logic Python)
            if cls_dets:
                best_cls = max(cls_dets, key=lambda x: x["confidence"])
                v8_conf = best_cls["confidence"]
                v8_label = best_cls["class"]
                
                v11_label = obj["class"]
                v11_is_dog = (obj["class_id"] == COCO_DOG_CLASS_ID)

                # Case 1: V11 bảo là Chó
                if v11_is_dog:
                    if v8_conf > config.BREED_CONF_THRESHOLD:
                        # V8 tin cậy -> Lấy giống chó cụ thể
                        obj["class"] = v8_label
                        obj["confidence"] = v8_conf
                    else:
                        # V8 không chắc -> Fallback về "Unknown Dog" (hoặc giữ "Dog")
                        obj["class"] = "Unknown Dog"
                        # Giữ confidence của V11 hoặc set lại
                
                # Case 2: V11 bảo là con khác (Ngựa, Mèo...)
                else:
                    if v8_conf > config.OVERRIDE_CONF_THRESHOLD:
                        # V8 cực kỳ chắc chắn -> Lật kèo thành Chó
                        obj["class"] = v8_label
                        obj["confidence"] = v8_conf
                    else:
                        # V8 không đủ tuổi lật -> Giữ nguyên nhãn của V11 (Ngựa, Mèo...)
                        pass 
            else:
                # V8 không ra gì cả (conf < 0.1)
                if obj["class_id"] == COCO_DOG_CLASS_ID:
                    obj["class"] = "Unknown Dog"
        
        final_results.append(obj)

    t_classify_end = time.time()

    final_results = apply_nms(final_results, iou_threshold=config.IOU)

    annotated_img = draw_annotations(img, final_results)
    _, buf = cv2.imencode(".jpg", annotated_img)
    
    t_end = time.time()
    preprocess_ms = (t_detect_start - t_start) * 1000
    detect_ms = (t_detect_end - t_detect_start) * 1000
    classify_ms = (t_classify_end - t_classify_start) * 1000
    total_ms = (t_end - t_start) * 1000
    
    print(f"[PERF] TYPE:IMAGE | Device: {config.device} | Preprocess: {preprocess_ms:.2f}ms | Detect: {detect_ms:.2f}ms | Classify: {classify_ms:.2f}ms | Total: {total_ms:.2f}ms", flush=True)

    return {
        "predictions": final_results,
        "processed_media_base64": base64.b64encode(buf).decode("utf-8"),
        "media_type": "image/jpeg"
    }

# --- LOGIC VIDEO: Hybrid Track ---
def cpu_process_video(video_bytes: bytes) -> Dict[str, Any]:
    t_start = time.time()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as t_in, \
         tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as t_out:
        t_in.write(video_bytes)
        t_in_path, t_out_path = t_in.name, t_out.name
    
    try:
        tracker = config.detect_model if config.detect_model else config.classify_model
        breed_cache = {}
        unique_results = {}
        VID_STRIDE = 3 
        
        # Step 1: Detect & Track (V11n)
        results_gen = tracker.track(
            t_in_path, stream=True, persist=True, 
            conf=config.VIDEO_CONF, 
            iou=config.IOU, 
            classes=ANIMAL_CLASSES,
            vid_stride=VID_STRIDE, verbose=False
        )

        cap = cv2.VideoCapture(t_in_path)
        fps_input = cap.get(cv2.CAP_PROP_FPS)
        fps = fps_input / VID_STRIDE
        writer = imageio.get_writer(t_out_path, fps=min(fps, 20), codec="libx264", pixelformat="yuv420p")

        frame_count = 0
        for res in results_gen:
            frame_count += 1
            frame = res.orig_img
            frame_dets = []
            
            if res.boxes and res.boxes.id is not None:
                boxes = res.boxes.xyxy.cpu().tolist()
                ids = res.boxes.id.int().cpu().tolist()
                classes = res.boxes.cls.int().cpu().tolist()

                for t_id, box, cls_id in zip(ids, boxes, classes):
                    v11_label = tracker.names[cls_id]
                    v11_is_dog = (cls_id == COCO_DOG_CLASS_ID)
                    
                    # Chỉ classify lại nếu chưa có trong cache hoặc muốn update
                    if t_id not in breed_cache:
                        crop = get_padded_crop(frame, box)
                        final_label = v11_label # Mặc định tin V11
                        final_conf = 0.5

                        if crop.size > 0:
                            # Step 2: Classify (V8s)
                            c_res = config.classify_model(crop, conf=config.CLASS_CONF, verbose=False)
                            c_dets = process_results(c_res, config.classify_model)
                            
                            # Step 3: Court Judgment
                            if c_dets:
                                best = max(c_dets, key=lambda x: x["confidence"])
                                v8_conf = best["confidence"]
                                v8_label = best["class"]

                                if v11_is_dog:
                                    if v8_conf > config.BREED_CONF_THRESHOLD:
                                        final_label = v8_label
                                        final_conf = v8_conf
                                    else:
                                        final_label = "Unknown Dog"
                                else: # Not dog
                                    if v8_conf > config.OVERRIDE_CONF_THRESHOLD:
                                        final_label = v8_label
                                        final_conf = v8_conf
                            else:
                                if v11_is_dog: final_label = "Unknown Dog"

                        breed_cache[t_id] = {"class": final_label, "confidence": final_conf}
                    
                    info = breed_cache[t_id]
                    det_obj = {
                        "track_id": t_id, "box": [int(x) for x in box],
                        "class": info["class"], "confidence": info["confidence"]
                    }
                    frame_dets.append(det_obj)
                    unique_results[t_id] = det_obj

            writer.append_data(cv2.cvtColor(draw_annotations(frame, frame_dets), cv2.COLOR_BGR2RGB))
        
        writer.close()
        cap.release()
        
        with open(t_out_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")
            
        gc.collect()
        
        t_end = time.time()
        duration_ms = (t_end - t_start) * 1000
        print(f"[PERF] TYPE:VIDEO | Device: {config.device} | Duration: {duration_ms:.2f}ms | Frames: {frame_count} | FPS: {fps:.2f}", flush=True)

        return {"predictions": list(unique_results.values()), "processed_media_base64": b64}
    finally:
        if os.path.exists(t_in_path): os.unlink(t_in_path)
        if os.path.exists(t_out_path): os.unlink(t_out_path)

# ==============================================================================
# 3. API ASYNC
# ==============================================================================

@app.get("/")
def health(): return {"status": "ok", "version": "12.0-Hybrid"}

@app.post("/config/reload", summary="Reload configuration from DB")
def reload_config(payload: dict = Body(...)):
    try:
        config.load(config_data=payload)
        if not config.classify_model:
            return JSONResponse(content={"status": "error", "message": "Configuration reloaded but model failed to load."}, status_code=500)
        
        return JSONResponse(content={
            "status": "ok", 
            "message": "Configuration and model reloaded successfully.", 
            "model": config.classify_model.names, 
            "device": config.device, 
            "image_conf": config.IMAGE_CONF, 
            "video_conf": config.VIDEO_CONF, 
            "stream_conf": config.STREAM_CONF,
            "iou": config.IOU
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)

@app.get("/config", summary="Get current configuration")
def get_config():
    if not config.classify_model:
        model_names = "Model not loaded"
    else:
        model_names = config.classify_model.names

    current_config = {
        "model_path": config.MODEL_PATH,
        "device": config.device,
        "image_conf": config.IMAGE_CONF,
        "video_conf": config.VIDEO_CONF,
        "stream_conf": config.STREAM_CONF,
        "iou": config.IOU,
        "model_classes": model_names,
    }
    return JSONResponse(content={"status": "ok", "configuration": current_config})

@app.post("/predict/image")
async def predict_image(file: UploadFile = File(...)):
    if not config.classify_model: return JSONResponse({"status": "error"}, 503)
    data = await file.read()
    res = await run_in_threadpool(cpu_process_image, data)
    return JSONResponse(res)

@app.post("/predict/images")
async def predict_images(files: List[UploadFile] = File(...)):
    print(f"[AI-API] Received predict_images request with {len(files)} files.", flush=True)
    if not config.classify_model: return JSONResponse({"status": "error"}, 503)
    results = []
    for file in files:
        data = await file.read()
        res = await run_in_threadpool(cpu_process_image, data)
        results.append(res)
    return JSONResponse({"results": results})

@app.post("/predict/video")
async def predict_video(file: UploadFile = File(...)):
    if not config.classify_model: return JSONResponse({"status": "error"}, 503)
    data = await file.read()
    res = await run_in_threadpool(cpu_process_video, data)
    return JSONResponse(res)

@app.post("/predict/url")
async def predict_url(payload: URLPayload):
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(str(payload.url), follow_redirects=True)
            ct = resp.headers.get("content-type", "").lower()
            if "image" in ct:
                res = await run_in_threadpool(cpu_process_image, resp.content)
                return JSONResponse(res)
            elif "video" in ct:
                res = await run_in_threadpool(cpu_process_video, resp.content)
                return JSONResponse(res)
            else:
                return JSONResponse({"status": "error", "message": "Unsupported content type"}, 400)
        except Exception as e:
            return JSONResponse({"status": "error", "message": str(e)}, 400)

# ==============================================================================
# 4. WEBSOCKET STREAM
# ==============================================================================

@app.websocket("/predict-stream")
async def ws_stream(websocket: WebSocket):
    """
    WebSocket Stream dùng DUY NHẤT config.classify_model.
    Đã fix lỗi 'Tensor object has no attribute conf'.
    """
    await websocket.accept()
    
    model = config.classify_model 
    if not model: 
        await websocket.close()
        return
    
    print(f"[AI-WS] Client connected. Model: {config.MODEL_PATH}", flush=True)

    tracker_args = SimpleNamespace(
        track_high_thresh=0.25,
        track_low_thresh=0.1,
        new_track_thresh=0.25,
        match_thresh=0.8,
        track_buffer=15,
        mot20=False,
        conf=0.25,      
        iou=0.6,        
        fuse_score=True 
    )
    local_tracker = BYTETracker(args=tracker_args, frame_rate=30)

    try:
        while True:
            data = await websocket.receive()
            if "bytes" in data:
                
                def process_stream_frame(binary_data):
                    nparr = np.frombuffer(binary_data, np.uint8)
                    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                    if frame is None: return None

                    results = model.predict(
                        frame, 
                        conf=config.STREAM_CONF, 
                        iou=0.6, 
                        verbose=False, 
                        imgsz=640
                    )
                    
                    if results and len(results[0].boxes) > 0:
                        det = results[0].boxes.cpu() 
                        online_targets = local_tracker.update(det, img=frame)
                    else:
                        online_targets = []

                    final_dets = []
                    for t in online_targets:
                        final_dets.append({
                            "track_id": int(t[4]),
                            "class_id": int(t[6]),
                            "class": model.names[int(t[6])],
                            "confidence": float(t[5]),
                            "box": [int(t[0]), int(t[1]), int(t[2]), int(t[3])]
                        })
                    return final_dets

                detections = await run_in_threadpool(process_stream_frame, data["bytes"])
                
                if detections is not None:
                    await websocket.send_json({
                        "status": "detecting", 
                        "detections": detections
                    })

    except WebSocketDisconnect:
        print("[AI-WS] Client disconnected")
    except Exception as e:
        print(f"[AI-WS] Error: {e}")
        
if __name__ == "__main__":
    port = int(os.environ.get('PORT', 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)