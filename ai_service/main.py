# main.py
import uvicorn
from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect, Body
from fastapi.responses import JSONResponse
from pymongo import MongoClient
from ultralytics import YOLO
import cv2
import numpy as np
import tempfile
import os
import uuid
import base64
import traceback
import imageio
import sys
from typing import List, Dict, Any
from dotenv import load_dotenv
from ultralytics.utils.plotting import Annotator, colors

# ==============================================================================
# 1. CONFIGURATION
# ==============================================================================
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=dotenv_path)

# MONGO_URI = os.getenv("MONGO_URI")
MONGO_URI = "nothingz"
DB_NAME = os.getenv("DB_NAME")
TRACKER_CONFIG = "bytetrack.yaml"

# ID của lớp 'dog' trong bộ dữ liệu COCO mà yolov8n được huấn luyện
COCO_DOG_CLASS_ID = 16

# --- Dynamic Configuration Holder ---
class Config:
    def __init__(self):
        self.model = None  # Model chính, chuyên sâu về giống chó, được config từ DB
        self.pre_filter_model = None # Model bộ lọc, được gán cứng, tự động tải về
        self.set_defaults()

        # Kết nối MongoDB
        try:
            if not MONGO_URI: raise ValueError("MONGO_URI environment variable is not set.")
            self.mongo_client = MongoClient(MONGO_URI)
            self.mongo_client.admin.command('ismaster')
            print(f"MongoDB connection successful")
            self.db = self.mongo_client[DB_NAME]
        except Exception as e:
            print(f"WARNING: Could not connect to MongoDB. Error: {e}")
            self.db = None

        # Tải model chính từ config DB
        self.load() 
        
        # Tải model bộ lọc một cách độc lập
        self._load_hardcoded_pre_filter_model()

        # Kiểm tra cuối cùng
        if self.model is None or self.pre_filter_model is None:
            raise RuntimeError("One or more models failed to initialize. Check logs. Shutting down.")
            
    def _load_hardcoded_pre_filter_model(self):
        model_name = "yolo11n.pt"
        model_path = os.path.join("models", model_name)
        print("-" * 50)
        print(f"Attempting to load hardcoded pre-filter model: {model_path}")
        try:
            # Đảm bảo thư mục 'models' tồn tại
            model_dir = os.path.dirname(model_path)
            if not os.path.exists(model_dir):
                os.makedirs(model_dir)
                print(f"Created directory: {model_dir}")

            # YOLO(model_path) sẽ tự động tải file vào đường dẫn chỉ định nếu nó không tồn tại.
            self.pre_filter_model = YOLO(model_path)
            self.pre_filter_model.to(self.DEVICE)
            print(f"Pre-filter model '{model_path}' loaded successfully.")
            print("-" * 50)
        except Exception as e:
            print(f"FATAL: Could not load or download pre-filter model '{model_path}'. Error: {e}")
            traceback.print_exc()
            self.pre_filter_model = None
            print("-" * 50)


    def load(self, config_data: dict = None):
        """Tải cấu hình và model CHÍNH từ DB."""
        if config_data:
            print("Applying configuration from provided data (e.g., /config/reload)...")
            self.apply_config_and_load_model(config_data)
        else:
            print("Loading MAIN model configuration from MongoDB on initial startup...")
            if self.db is None:
                print("⚠️ DB not connected. Using hardcoded defaults for MAIN model.")
                self.apply_config_and_load_model({})
                return

            config_doc = self.db.configurations.find_one({"key": "model_thresholds"})
            active_model_doc = self.db.ai_models.find_one({"status": "ACTIVE", "taskType": "DOG_BREED_CLASSIFICATION"})

            full_config = config_doc if config_doc else {}
            if active_model_doc:
                full_config["model_path"] = active_model_doc.get("fileName")
                full_config["huggingface_repo"] = active_model_doc.get("huggingFaceRepo")
            
            if not config_doc and not active_model_doc:
                print("⚠️ No configuration or active model found in DB. Using hardcoded defaults for MAIN model.")

            self.apply_config_and_load_model(full_config)
        
    def apply_config_and_load_model(self, config_data: dict):
        """Áp dụng cấu hình và chỉ tải lại model CHÍNH."""
        self.IMAGE_CONF_THRESHOLD = config_data.get("image_conf", self.IMAGE_CONF_THRESHOLD)
        self.VIDEO_CONF_THRESHOLD = config_data.get("video_conf", self.VIDEO_CONF_THRESHOLD)
        self.STREAM_CONF_THRESHOLD = config_data.get("stream_conf", self.STREAM_CONF_THRESHOLD)
        self.STREAM_HIGH_CONF_THRESHOLD = config_data.get("stream_high_conf", self.STREAM_HIGH_CONF_THRESHOLD)
        self.DEVICE = config_data.get("device", self.DEVICE)
        
        model_filename = os.path.basename(config_data.get("model_path") or self.MODEL_PATH)
        self.MODEL_PATH = os.path.join("models", model_filename)
        self.HUGGINGFACE_REPO = config_data.get("huggingface_repo", self.HUGGINGFACE_REPO)

        print("✅ Main model configuration applied:")
        print(f"   - Model Path: {self.MODEL_PATH}")
        print(f"   - Device: {self.DEVICE}")

        if not self.MODEL_PATH:
            print("❌ FATAL: Main model path is missing. Cannot load model.")
            self.model = None
            return

        model_dir = os.path.dirname(self.MODEL_PATH)
        if model_dir and not os.path.exists(model_dir):
            os.makedirs(model_dir)

        if not os.path.exists(self.MODEL_PATH) and self.HUGGINGFACE_REPO:
            self.download_model()

        try:
            if not os.path.exists(self.MODEL_PATH):
                raise FileNotFoundError(f"Main model file not found at {self.MODEL_PATH}")

            print(f"Loading MAIN model from path: {self.MODEL_PATH} onto device: {self.DEVICE}")
            self.model = YOLO(self.MODEL_PATH) 
            self.model.to(self.DEVICE)
            print("✅ MAIN model loaded successfully with classes:", self.model.names)
        except Exception as e:
            print(f"❌ FATAL: Error loading MAIN model from path '{self.MODEL_PATH}'. Error: {e}")
            self.model = None

    def download_model(self):
        from huggingface_hub import hf_hub_download
        print(f"Main model not found at {self.MODEL_PATH}. Downloading from Hugging Face...")
        try:
            hf_hub_download(repo_id=self.HUGGINGFACE_REPO, filename=os.path.basename(self.MODEL_PATH), local_dir=os.path.dirname(self.MODEL_PATH))
            print("Model downloaded successfully.")
        except Exception as e:
            print(f"Error downloading model from repo '{self.HUGGINGFACE_REPO}': {e}")
    
    def set_defaults(self):
        self.IMAGE_CONF_THRESHOLD = 0.25
        self.VIDEO_CONF_THRESHOLD = 0.5
        self.STREAM_CONF_THRESHOLD = 0.4
        self.STREAM_HIGH_CONF_THRESHOLD = 0.8
        self.DEVICE = "cuda"
        self.MODEL_PATH = "models/model_v8s_pro.pt"
        self.HUGGINGFACE_REPO = "HakuDevon/Dog_Breed_ID"

# ==============================================================================
# 2. INITIALIZATION
# ==============================================================================
app = FastAPI(title="Dog Breed Inference API", description="An API to predict dog breeds using a smart two-stage YOLOv8 pipeline.", version="8.0.0")

try:
    config = Config()
except RuntimeError as e:
    print(f"❌ FATAL STARTUP ERROR: {e}")
    sys.exit(1)

# ==============================================================================
# 3. HELPER FUNCTIONS
# ==============================================================================
def process_results(results, model) -> List[Dict[str, Any]]:
    detections = []
    if not model or not results or not hasattr(results, 'boxes') or not results.boxes:
        return detections
        
    boxes = results.boxes
    track_ids = (boxes.id.int().cpu().tolist() if boxes.id is not None else [None] * len(boxes))
    class_ids = boxes.cls.int().cpu().tolist()
    confs = boxes.conf.float().cpu().tolist()
    xyxy_coords = boxes.xyxy.cpu().tolist()

    for track_id, class_id, conf, xyxy in zip(track_ids, class_ids, confs, xyxy_coords):
        detections.append({
            "track_id": track_id,
            "class_id": class_id,
            "class": model.names[class_id], 
            "confidence": conf,
            "box": [round(coord) for coord in xyxy],
        })
    return detections

def draw_custom_annotations(frame, detections: List[Dict[str, Any]], model):
    annotated_frame = frame.copy()
    if not model:
        return annotated_frame
        
    annotator = Annotator(annotated_frame, line_width=2, example=str(model.names))

    for det in detections:
        label = f"{det['class']} {det['confidence']:.2f}"
        if det.get("track_id") is not None:
            label = f"ID:{det['track_id']} {label}"
        annotator.box_label(det["box"], label, color=colors(det["class_id"], True))
    return annotator.result()

# ==============================================================================
# 4. API ENDPOINTS
# ==============================================================================
@app.get("/", summary="Health Check")
def health_check():
    return JSONResponse(content={"status": "ok", "message": "YOLOv8 Inference Service is running."})

@app.post("/config/reload", summary="Reload configuration from DB")
def reload_config(payload: dict = Body(...)):

    """Forces the service to reload its configuration and model from the database."""
    try:
        config.load(config_data=payload)
        if not config.model:
            return JSONResponse(content={"status": "error", "message": "Configuration reloaded but model failed to load. Check logs."}, status_code=500)
            
        return JSONResponse(content={"status": "ok", "message": "Configuration and model reloaded successfully.", "model": config.model.names, "device": config.DEVICE, "image_conf_threshold": config.IMAGE_CONF_THRESHOLD, "video_conf_threshold": config.VIDEO_CONF_THRESHOLD, "stream_conf_threshold": config.STREAM_CONF_THRESHOLD, "stream_high_conf_threshold": config.STREAM_HIGH_CONF_THRESHOLD})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)


@app.get("/config", summary="Get current configuration")
def get_config():
    """Returns the currently active configuration of the AI service."""
    if not config.model:
        model_names = "Model not loaded"
    else:
        model_names = config.model.names

    current_config = {
        "model_path": config.MODEL_PATH,
        "device": config.DEVICE,
        "image_conf_threshold": config.IMAGE_CONF_THRESHOLD,
        "video_conf_threshold": config.VIDEO_CONF_THRESHOLD,
        "stream_conf_threshold": config.STREAM_CONF_THRESHOLD,
        "stream_high_conf_threshold": config.STREAM_HIGH_CONF_THRESHOLD,
        "model_classes": model_names,
    }
    return JSONResponse(content={"status": "ok", "configuration": current_config})

@app.post("/predict/image", summary="Predict from a single image with smart filtering")
async def predict_from_image_file(file: UploadFile = File(...)):
    if not config.model or not config.pre_filter_model:
        return JSONResponse(content={"status": "error", "message": "Models not loaded"}, status_code=503)
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return JSONResponse(content={"status": "error", "message": "Could not decode image."}, status_code=400)

        # Giai đoạn 1: Chạy model bộ lọc nhanh trên toàn bộ ảnh
        pre_filter_results = config.pre_filter_model(img, conf=0.1, verbose=False)
        all_detections = process_results(pre_filter_results[0], config.pre_filter_model)
        
        # Kiểm tra xem có chó trong kết quả không
        dog_found = any(d['class_id'] == COCO_DOG_CLASS_ID for d in all_detections)
        final_detections, annotated_image = [], img
        
        if dog_found:
            # Giai đoạn 2: Có chó, chạy model chính trên TOÀN BỘ ảnh
            print("Dog detected. Running main model for breed classification on the full image.")
            main_model_results = config.model.track(img, persist=False, conf=config.IMAGE_CONF_THRESHOLD, verbose=False)
            final_detections = process_results(main_model_results[0], config.model)
            annotated_image = draw_custom_annotations(img, final_detections, config.model)
        elif all_detections:
            # Không có chó, nhưng có vật khác -> trả về kết quả từ bộ lọc
            print(f"No dogs found. Returning general detections: {[d['class'] for d in all_detections]}")
            final_detections = all_detections
            annotated_image = draw_custom_annotations(img, final_detections, config.pre_filter_model)
        else:
            print("No objects detected.")

        _, buffer = cv2.imencode(".jpg", annotated_image)
        processed_image_base64 = base64.b64encode(buffer).decode("utf-8")

        return JSONResponse(content={
            "predictions": sorted(final_detections, key=lambda x: x["confidence"], reverse=True),
            "processed_media_base64": processed_image_base64,
            "media_type": "image/jpeg",
        })
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(content={"status": "error", "message": f"An internal error occurred: {str(e)}"}, status_code=500)
@app.post("/predict/video", summary="Process a video with smart filtering")
async def predict_from_video_file(file: UploadFile = File(...)):
    if not config.model or not config.pre_filter_model: 
        return JSONResponse(content={"status": "error", "message": "Models not loaded"}, status_code=503)

    tmp_in_path, tmp_out_path = "", ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp_in, \
             tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp_out:
            contents = await file.read()
            tmp_in.write(contents)
            tmp_in_path, tmp_out_path = tmp_in.name, tmp_out.name
        
        cap = cv2.VideoCapture(tmp_in_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        video_writer = imageio.get_writer(tmp_out_path, fps=fps, codec="libx264", pixelformat="yuv420p", macro_block_size=1)
        tracked_objects = {}
        
        # Giai đoạn 1: Dùng model lọc để quét qua video
        pre_filter_stream = config.pre_filter_model.track(tmp_in_path, stream=True, conf=0.5, verbose=False)

        for pre_filter_results in pre_filter_stream:
            frame = pre_filter_results.orig_img
            all_detections = process_results(pre_filter_results, config.pre_filter_model)
            dog_found = any(d['class_id'] == COCO_DOG_CLASS_ID for d in all_detections)

            annotated_frame, current_frame_detections = frame, []

            if dog_found:
                # Giai đoạn 2: Có chó, chạy model chính trên TOÀN BỘ frame
                main_model_results = config.model.track(frame, persist=True, conf=config.VIDEO_CONF_THRESHOLD, verbose=False, tracker=TRACKER_CONFIG)
                current_frame_detections = process_results(main_model_results[0], config.model)
                annotated_frame = draw_custom_annotations(frame, current_frame_detections, config.model)
            elif all_detections:
                # Không có chó, dùng kết quả từ bộ lọc
                current_frame_detections = all_detections
                annotated_frame = draw_custom_annotations(frame, current_frame_detections, config.pre_filter_model)
            
            # Logic thu thập các đối tượng đã được track không đổi
            for det in current_frame_detections:
                track_id = det.get("track_id")
                unique_key = f"{det['class']}-{track_id}" 
                if track_id is not None and (unique_key not in tracked_objects or det["confidence"] > tracked_objects[unique_key]["confidence"]):
                    tracked_objects[unique_key] = det
            
            rgb_frame = cv2.cvtColor(annotated_frame, cv2.COLOR_BGR2RGB)
            video_writer.append_data(rgb_frame)

        video_writer.close()
        cap.release()
        
        final_predictions = list(tracked_objects.values())
        with open(tmp_out_path, "rb") as video_file:
            processed_video_base64 = base64.b64encode(video_file.read()).decode("utf-8")

        return JSONResponse(content={
            "predictions": sorted(final_predictions, key=lambda x: x.get("track_id", 0)),
            "processed_media_base64": processed_video_base64,
            "media_type": "video/mp4",
        })
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(content={"status": "error", "message": f"An internal error occurred: {str(e)}"}, status_code=500)
    finally:
        if 'cap' in locals() and cap and cap.isOpened(): cap.release()
        if 'video_writer' in locals() and video_writer: video_writer.close()
        if os.path.exists(tmp_in_path): os.unlink(tmp_in_path)
        if os.path.exists(tmp_out_path): os.unlink(tmp_out_path)

@app.websocket("/predict-stream")
async def predict_stream(websocket: WebSocket):
    await websocket.accept()
    if not config.model or not config.pre_filter_model: 
        await websocket.send_json({"status": "error", "message": "Models not loaded"})
        await websocket.close(); return

    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect": raise WebSocketDisconnect
            data = message.get("text", "")
            if not data.startswith('data:image'): continue

            img_data = base64.b64decode(data.split(",")[1])            
            nparr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is not None:
                # Giai đoạn 1: Chạy model bộ lọc nhanh trên toàn bộ frame
                pre_filter_results = config.pre_filter_model(img, conf=config.STREAM_CONF_THRESHOLD, verbose=False)
                all_detections = process_results(pre_filter_results[0], config.pre_filter_model)
                dog_found = any(d['class_id'] == COCO_DOG_CLASS_ID for d in all_detections)
                
                response_payload = {"status": "detecting", "detections": []}

                if dog_found:
                    # Giai đoạn 2: Có chó, chạy model chính trên TOÀN BỘ frame
                    main_model_results = config.model.track(img, persist=True, conf=config.STREAM_CONF_THRESHOLD, verbose=False, tracker=TRACKER_CONFIG)
                    final_detections = process_results(main_model_results[0], config.model)
                    
                    high_conf_detections = [d for d in final_detections if d["confidence"] > config.STREAM_HIGH_CONF_THRESHOLD]
                    if high_conf_detections:
                        annotated_frame = draw_custom_annotations(img, high_conf_detections, config.model)
                        _, buffer = cv2.imencode(".jpg", annotated_frame)
                        processed_image_base64 = base64.b64encode(buffer).decode("utf-8")
                        response_payload = {
                            "status": "captured", 
                            "predictionId": str(uuid.uuid4()), 
                            "processed_media_base64": processed_image_base64,
                            "media_type": "image/jpeg", 
                            "detections": high_conf_detections,
                        }
                        await websocket.send_json(response_payload)
                        break # Kết thúc stream khi đã chụp được ảnh chất lượng cao
                    else:
                        response_payload["detections"] = final_detections
                elif all_detections:
                    # Không có chó, trả về kết quả từ bộ lọc
                    response_payload["detections"] = all_detections
                
                await websocket.send_json(response_payload)
            else:
                await websocket.send_json({"status": "error", "message": "Could not decode image."})

    except WebSocketDisconnect:
        print("[WS] Client disconnected.")
    except Exception as e:
        print(f"WebSocket Error: {e}")
        traceback.print_exc()


# ==============================================================================
# 5. SERVER RUN
# ==============================================================================
if __name__ == "__main__":
    port = int(os.environ.get('PORT', 8000))
    uvicorn.run("main:app", host="localhost", port=port, reload=True)