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
torch.set_num_threads(1) # Giới hạn thread CPU để tránh nghẽn server

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
        self.classify_model = None   # Model CHÍNH (Nhận diện giống - Nặng)
        self.detect_model = None     # Model PHỤ (Tìm vị trí chó - Nhẹ)
        self.device = "cpu"
        
        # Kết nối DB
        try:
            if MONGO_URI:
                self.mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
                self.db = self.mongo_client[DB_NAME]
                print("✅ MongoDB connection successful", flush=True)
            else:
                self.db = None
        except Exception as e:
            print(f"⚠️ MongoDB Error: {e}", flush=True)
            self.db = None

        self.load() 
        self._load_detector()

    def _load_detector(self):
        """Load model Nano nhẹ chỉ để tìm vị trí (Logic của V9.6)"""
        path = "models/yolo11n.pt"
        if not os.path.exists("models"): os.makedirs("models")
        try:
            print(f"--> Loading DETECTOR (yolo11n)...", flush=True)
            self.detect_model = YOLO(path)
            self.detect_model.to(self.device)
        except Exception as e:
            print(f"❌ Detector load failed: {e}. Will use Classify Model for detection.", flush=True)
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
                    print(f"⚠️ [CONFIG] Lỗi khi đọc cấu hình từ DB: {e}", flush=True)

            print(f"[CONFIG] Tổng hợp cấu hình cuối cùng để áp dụng: {full_config}", flush=True)
            self._apply_config(full_config)

    def _apply_config(self, config_data: dict):
        print(f"[CONFIG] Bắt đầu áp dụng cấu hình: {config_data}", flush=True)
        self.IMAGE_CONF = config_data.get("image_conf", 0.25)
        self.VIDEO_CONF = config_data.get("video_conf", 0.5)
        self.STREAM_CONF = config_data.get("stream_conf", 0.4)
        self.IOU= config_data.get("iou", 0.5)
        self.device = config_data.get("device", "cpu")
        
        filename = os.path.basename(config_data.get("model_path") or "model_v8s_pro.pt")
        self.MODEL_PATH = os.path.join("models", filename)
        self.HUGGINGFACE_REPO = config_data.get("huggingface_repo", "HakuDevon/Dog_Breed_ID")
        
        print("--- [CONFIG] Giá trị đã áp dụng ---", flush=True)
        print(f"  - IMAGE_CONF: {self.IMAGE_CONF}", flush=True)
        print(f"  - VIDEO_CONF: {self.VIDEO_CONF}", flush=True)
        print(f"  - STREAM_CONF: {self.STREAM_CONF}", flush=True)
        print(f"  - device: {self.device}", flush=True)
        print(f"  - MODEL_PATH: {self.MODEL_PATH}", flush=True)
        print(f"  - HUGGINGFACE_REPO: {self.HUGGINGFACE_REPO}", flush=True)
        print("---------------------------------", flush=True)
        if not os.path.exists(os.path.dirname(self.MODEL_PATH)): os.makedirs(os.path.dirname(self.MODEL_PATH))
        if not os.path.exists(self.MODEL_PATH): self._download_model()
            
        try:
            print(f"--> Loading CLASSIFIER: {self.MODEL_PATH}...", flush=True)
            self.classify_model = YOLO(self.MODEL_PATH)
            self.classify_model.to(self.device)
            # Warmup
            self.classify_model(np.zeros((640, 640, 3), dtype=np.uint8), verbose=False) 
            print("✅ CLASSIFIER loaded.", flush=True)
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

# --- LOGIC ẢNH: GIỮ NGUYÊN SỨC MẠNH CỦA V9.6 ---
def cpu_process_image(image_bytes: bytes) -> Dict[str, Any]:
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None: raise ValueError("Invalid image")

    # 1. Dùng Detect Model (Nhẹ) để tìm TẤT CẢ vật thể (Chó, Mèo, Xe...)
    detector = config.detect_model if config.detect_model else config.classify_model
    # Conf thấp để không bỏ sót
    detect_res = detector(img, conf=0.15, verbose=False) 
    base_objects = process_results(detect_res, detector)

    final_results = []
    
    # 2. Duyệt từng vật thể
    for obj in base_objects:
        # Nếu là CHÓ (hoặc model detect chỉ có class chó)
        # Giả sử detect_model là COCO (80 class), class 16 là chó
        is_dog = (obj['class_id'] == COCO_DOG_CLASS_ID) or (len(detector.names) == 1)
        
        if is_dog:
            # Cắt ảnh (Crop) và chạy Model Classify (Nặng & Chính xác)
            crop = get_padded_crop(img, obj["box"])
            if crop.size > 0:
                cls_res = config.classify_model(crop, conf=config.IMAGE_CONF, verbose=False)
                cls_dets = process_results(cls_res, config.classify_model)
                
                if cls_dets:
                    # Lấy kết quả tốt nhất và map lại box gốc
                    best = max(cls_dets, key=lambda x: x["confidence"])
                    best["box"] = obj["box"]
                    final_results.append(best)
                else:
                    # Classify không ra -> Vẫn giữ là "Dog"
                    obj["class"] = "Unknown Dog"
                    final_results.append(obj)
        else:
            # Không phải chó (Mèo, Người...) -> Giữ nguyên để hiển thị
            final_results.append(obj)

    annotated_img = draw_annotations(img, final_results)
    _, buf = cv2.imencode(".jpg", annotated_img)
    return {
        "predictions": final_results,
        "processed_media_base64": base64.b64encode(buf).decode("utf-8"),
        "media_type": "image/jpeg"
    }

# --- LOGIC VIDEO: GIỮ SỨC MẠNH CỦA V10 (Optimized) ---
def cpu_process_video(video_bytes: bytes) -> Dict[str, Any]:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as t_in, \
         tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as t_out:
        t_in.write(video_bytes)
        t_in_path, t_out_path = t_in.name, t_out.name
    
    try:
        # Dùng Detect Model để Track (nhanh hơn dùng Classify Model track)
        tracker = config.detect_model if config.detect_model else config.classify_model
        
        # Cache: { track_id: {class: "Husky", conf: 0.9} }
        # Logic: Chỉ classify 1 lần cho mỗi ID để tiết kiệm CPU
        breed_cache = {}
        unique_results = {}
        
        VID_STRIDE = 3 # Nhảy frame để tăng tốc
        
        results_gen = tracker.track(
            t_in_path, stream=True, persist=True, 
            conf=config.VIDEO_CONF, vid_stride=VID_STRIDE, verbose=False
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
                        # Nếu ID này chưa từng được Classify -> Crop & Classify ngay
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
                        
                        # Lấy info từ Cache
                        info = breed_cache[t_id]
                        det_obj = {
                            "track_id": t_id, "box": [int(x) for x in box],
                            "class": info["class"], "confidence": info["confidence"]
                        }
                        frame_dets.append(det_obj)
                        unique_results[t_id] = det_obj
                    else:
                        # Vật thể khác (Mèo...)
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
# 3. API ASYNC (NON-BLOCKING)
# ==============================================================================

@app.get("/")
def health(): return {"status": "ok", "version": "12.0-Hybrid"}

@app.post("/config/reload")
def reload(p: dict = Body(...)): config.load(p); return {"status": "ok"}

@app.post("/predict/image")
async def predict_image(file: UploadFile = File(...)):
    if not config.classify_model: return JSONResponse({"status": "error"}, 503)
    data = await file.read()
    # Chạy CPU bound task trong ThreadPool để không block server
    res = await run_in_threadpool(cpu_process_image, data)
    return JSONResponse(res)

@app.post("/predict/video")
async def predict_video(file: UploadFile = File(...)):
    if not config.classify_model: return JSONResponse({"status": "error"}, 503)
    data = await file.read()
    res = await run_in_threadpool(cpu_process_video, data)
    return JSONResponse(res)

@app.post("/predict/url")
async def predict_url(payload: URLPayload):
    async with httpx.AsyncClient() as client:
        resp = await client.get(str(payload.url), follow_redirects=True)
        ct = resp.headers.get("content-type", "").lower()
        if "image" in ct:
            res = await run_in_threadpool(cpu_process_image, resp.content)
            return JSONResponse(res)
        elif "video" in ct:
            res = await run_in_threadpool(cpu_process_video, resp.content)
            return JSONResponse(res)
    return JSONResponse({"status": "error"}, 400)

# ==============================================================================
# 4. WEBSOCKET STREAM

@app.websocket("/predict-stream")
async def ws_stream(websocket: WebSocket):
    """
    Logic Stream chuẩn V10:
    - Nhận Frame -> Track -> Trả JSON.
    - Không xử lý Text.
    - Không Resize ngoài luồng (dùng imgsz=640 của YOLO).
    """
    await websocket.accept()
    # Ở V12 mình gọi là classify_model, nhưng logic là Main Model của V10
    if not config.classify_model: 
        await websocket.close()
        return
    
    print(f"[AI-WS] Stream connected (V10 Logic).", flush=True)

    try:
        while True:
            data = await websocket.receive()
            
            # Client gửi ảnh dưới dạng bytes
            if "bytes" in data:
                # Hàm này bọc logic V10 để chạy async
                def process_frame_v10(binary_data):
                    nparr = np.frombuffer(binary_data, np.uint8)
                    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                    
                    if frame is None: return None

                    # LOGIC V10 GỐC: imgsz=640, track trực tiếp
                    results = config.classify_model.track(
                        frame,
                        persist=True,
                        conf=config.STREAM_CONF, # Lấy từ config
                        iou=0.5,
                        verbose=False,
                        imgsz=640 
                    )
                    return process_results(results, config.classify_model)

                # Chạy trong Threadpool để không treo server (Non-blocking)
                detections = await run_in_threadpool(process_frame_v10, data["bytes"])
                
                # Chỉ gửi JSON (Logic V10)
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
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get('PORT', 8000)))