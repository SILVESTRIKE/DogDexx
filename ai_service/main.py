import uvicorn
from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect, Body
from fastapi.responses import JSONResponse
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from ultralytics import YOLO
from ultralytics.utils.plotting import Annotator, colors
import cv2
import numpy as np
import tempfile
import os
import base64
import imageio
import httpx
import torch
import asyncio
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

class URLPayload(BaseModel):
    url: HttpUrl

class Config:
    def __init__(self):
        self.classify_model = None   # Model CHÍNH
        self.detect_model = None     # Model PHỤ
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
            print(f"--> Loading DETECTOR (yolo11n)...", flush=True)
            self.detect_model = YOLO(path)
            self.detect_model.to(self.device)
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
        
        self.IMAGE_CONF = float(config_data.get("image_conf", 0.25))
        self.VIDEO_CONF = float(config_data.get("video_conf", 0.5))
        self.STREAM_CONF = float(config_data.get("stream_conf", 0.4))
        self.CLASS_CONF = float(config_data.get("class_conf", 0.25))
        
        # Xử lý IOU (Convert string từ DB sang float)
        iou_val = config_data.get("iou", 0.5)
        try:
            self.IOU = float(iou_val)
        except:
            self.IOU = 0.5

        self.device = config_data.get("device", "cpu")
        
        if "cuda" in self.device and not torch.cuda.is_available():
            print("CUDA is not available. Switching to CPU.", flush=True)
            self.device = "cpu"
        
        filename = os.path.basename(config_data.get("model_path") or "model_v8s_pro.pt")
        self.MODEL_PATH = os.path.join("models", filename)
        self.HUGGINGFACE_REPO = config_data.get("huggingface_repo", "HakuDevon/Dog_Breed_ID")
        
        print("--- [CONFIG] Giá trị đã áp dụng ---", flush=True)
        print(f"  - IMAGE_CONF: {self.IMAGE_CONF}", flush=True)
        print(f"  - VIDEO_CONF: {self.VIDEO_CONF}", flush=True)
        print(f"  - STREAM_CONF: {self.STREAM_CONF}", flush=True)
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
            self.classify_model.to(self.device)
            # Warmup
            self.classify_model(np.zeros((640, 640, 3), dtype=np.uint8), verbose=False) 
            print("CLASSIFIER loaded.", flush=True)
        except Exception as e:
            print(f"❌ Classify model error: {e}", flush=True)

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

config = None
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

# --- LOGIC ẢNH: Hybrid (Detect -> Classify) ---
def cpu_process_image(image_bytes: bytes) -> Dict[str, Any]:
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None: raise ValueError("Invalid image")

    # 1. Dùng Detect Model
    detector = config.detect_model if config.detect_model else config.classify_model
    detect_res = detector(img, conf=0.15, verbose=False) 
    base_objects = process_results(detect_res, detector)

    final_results = []
    
    # Tách ra làm 2 nhóm: Chó và Không phải chó
    dog_objs = []
    other_objs = []

    for obj in base_objects:
        # Kiểm tra điều kiện là chó
        is_dog = (obj['class_id'] == COCO_DOG_CLASS_ID) or (len(detector.names) == 1)
        if is_dog:
            dog_objs.append(obj)
        else:
            other_objs.append(obj)
    
    # TRƯỜNG HỢP 1: Có chó trong ảnh
    if len(dog_objs) > 0:
        # Chỉ xử lý và trả về danh sách chó (bỏ qua other_objs)
        for obj in dog_objs:
            crop = get_padded_crop(img, obj["box"])
            if crop.size > 0:
                # Chạy qua model classify
                cls_res = config.classify_model(crop, conf=config.IMAGE_CONF, verbose=False)
                cls_dets = process_results(cls_res, config.classify_model)
                
                if cls_dets:
                    best = max(cls_dets, key=lambda x: x["confidence"])
                    best["box"] = obj["box"]
                    final_results.append(best)
                else:
                    obj["class"] = "Unknown Dog"
                    final_results.append(obj)
            else:
                final_results.append(obj)

    # TRƯỜNG HỢP 2: Không có chó nào
    else:
        # Trả về các vật thể khác (không qua classifier)
        final_results = other_objs

    final_results = apply_nms(final_results, iou_threshold=config.IOU)

    annotated_img = draw_annotations(img, final_results)
    _, buf = cv2.imencode(".jpg", annotated_img)
    return {
        "predictions": final_results,
        "processed_media_base64": base64.b64encode(buf).decode("utf-8"),
        "media_type": "image/jpeg"
    }

# --- LOGIC VIDEO: Hybrid Track ---
def cpu_process_video(video_bytes: bytes) -> Dict[str, Any]:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as t_in, \
         tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as t_out:
        t_in.write(video_bytes)
        t_in_path, t_out_path = t_in.name, t_out.name
    
    try:
        tracker = config.detect_model if config.detect_model else config.classify_model
        breed_cache = {}
        unique_results = {}
        VID_STRIDE = 3 
        
        results_gen = tracker.track(
            t_in_path, stream=True, persist=True, 
            conf=config.VIDEO_CONF, 
            iou=config.IOU, # Dùng IOU từ Config
            vid_stride=VID_STRIDE, verbose=False
        )

        cap = cv2.VideoCapture(t_in_path)
        fps = cap.get(cv2.CAP_PROP_FPS) / VID_STRIDE
        writer = imageio.get_writer(t_out_path, fps=min(fps, 20), codec="libx264", pixelformat="yuv420p")

        for res in results_gen:
            frame = res.orig_img
            frame_dets = []
            
            if res.boxes and res.boxes.id is not None:
                boxes = res.boxes.xyxy.cpu().tolist()
                ids = res.boxes.id.int().cpu().tolist()
                classes = res.boxes.cls.int().cpu().tolist()

                for t_id, box, cls_id in zip(ids, boxes, classes):
                    is_dog = (cls_id == COCO_DOG_CLASS_ID) or (len(tracker.names) == 1)
                    
                    if is_dog:
                        if t_id not in breed_cache:
                            crop = get_padded_crop(frame, box)
                            if crop.size > 0:
                                c_res = config.classify_model(crop, conf=0.4, verbose=False)
                                c_dets = process_results(c_res, config.classify_model)
                                if c_dets:
                                    best = max(c_dets, key=lambda x: x["confidence"])
                                    breed_cache[t_id] = {"class": best["class"], "confidence": best["confidence"]}
                                else:
                                    breed_cache[t_id] = {"class": "Dog", "confidence": 0.0}
                            else:
                                breed_cache[t_id] = {"class": "Dog", "confidence": 0.0}
                        
                        info = breed_cache[t_id]
                        det_obj = {
                            "track_id": t_id, "box": [int(x) for x in box],
                            "class": info["class"], "confidence": info["confidence"]
                        }
                        frame_dets.append(det_obj)
                        unique_results[t_id] = det_obj
                    else:
                        frame_dets.append({
                            "track_id": t_id, "box": [int(x) for x in box],
                            "class": tracker.names[cls_id], "confidence": 0.5
                        })

            writer.append_data(cv2.cvtColor(draw_annotations(frame, frame_dets), cv2.COLOR_BGR2RGB))
        
        writer.close()
        cap.release()
        
        with open(t_out_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")
            
        gc.collect()
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
    """Logic Stream chuẩn V10"""
    await websocket.accept()
    if not config.classify_model: 
        await websocket.close()
        return
    
    print(f"[AI-WS] Stream connected (V10 Logic).", flush=True)

    try:
        while True:
            data = await websocket.receive()
            if "bytes" in data:
                def process_frame_v10(binary_data):
                    nparr = np.frombuffer(binary_data, np.uint8)
                    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                    if frame is None: return None

                    # Sử dụng IOU và Conf từ Config
                    results = config.classify_model.track(
                        frame,
                        persist=True,
                        conf=config.STREAM_CONF, 
                        iou=config.IOU, 
                        verbose=False,
                        imgsz=640 
                    )
                    return process_results(results, config.classify_model)

                detections = await run_in_threadpool(process_frame_v10, data["bytes"])
                
                if detections is not None:
                    await websocket.send_json({
                        "status": "detecting", 
                        "detections": detections
                    })

    except WebSocketDisconnect:
        print("[AI-WS] Stream disconnected")
    except Exception as e:
        print(f"[AI-WS] Error: {e}")

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)