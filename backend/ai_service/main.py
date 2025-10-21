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
import json
import uuid
import base64
import traceback
import asyncio
import imageio
from typing import List, Dict, Any
from dotenv import load_dotenv
from ultralytics.utils.plotting import Annotator, colors

# ==============================================================================
# 1. CONFIGURATION
# ==============================================================================
# --- FIX: Load environment variables from .env file ---
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "dog_breed_db")

TRACKER_CONFIG = "bytetrack.yaml"

# --- Dynamic Configuration Holder ---
class Config:
    def __init__(self):
        try:
            self.mongo_client = MongoClient(MONGO_URI)
            # The ismaster command is cheap and does not require auth.
            self.mongo_client.admin.command('ismaster')
            print(f"✅ MongoDB connection successful to URI ending with: ...{MONGO_URI[-20:]}")
            self.db = self.mongo_client[DB_NAME]
            self.model = None  # Model instance
            self.set_defaults() # Set defaults first
            # Tải cấu hình lần đầu khi khởi động
            self.load() # Then try to load from DB
        except Exception as e:
            print(f"❌ FATAL: Could not connect to MongoDB at {MONGO_URI}. Error: {e}")
            print("   - Please ensure MongoDB is running and MONGO_URI in your .env file is correct.")
            self.db = None
            self.model = None
            self.set_defaults()

    def load(self, config_data: dict = None):
        """
        Tải cấu hình. Nếu config_data được cung cấp, sử dụng nó.
        Nếu không, đọc từ MongoDB.
        """
        if self.db is None:
            print("⚠️ Skipping config load because DB connection failed.")
            self.apply_config_and_load_model({})
            return

        if config_data:
            print("Applying configuration from provided data (e.g., /config/reload)...")
            self.apply_config_and_load_model(config_data)
        else:
            print("Loading configuration from MongoDB on initial startup...")
            # Lấy cả config và model active
            config_doc = self.db.configurations.find_one({"key": "model_thresholds"})
            active_model_doc = self.db.ai_models.find_one({"status": "ACTIVE", "taskType": "DOG_BREED_CLASSIFICATION"})

            if config_doc:
                # Kết hợp thông tin từ cả hai
                full_config = {**config_doc}
                if active_model_doc:
                    full_config["model_path"] = active_model_doc.get("fileName")
                    full_config["huggingface_repo"] = active_model_doc.get("huggingFaceRepo")
                    full_config["labels_path"] = active_model_doc.get("labelsFileName")
                self.apply_config_and_load_model(full_config)
            else:
                print("⚠️ No configuration found in DB. Using hardcoded defaults.")
                self.apply_config_and_load_model({}) # Dùng giá trị mặc định
        
    def apply_config_and_load_model(self, config_data: dict):
        """Áp dụng các giá trị cấu hình và tải lại model."""
        self.IMAGE_CONF_THRESHOLD = config_data.get("image_conf")
        self.VIDEO_CONF_THRESHOLD = config_data.get("video_conf")
        self.STREAM_CONF_THRESHOLD = config_data.get("stream_conf")
        self.STREAM_HIGH_CONF_THRESHOLD = config_data.get("stream_high_conf")
        self.DEVICE = config_data.get("device")
        self.MODEL_PATH = config_data.get("model_path")
        self.HUGGINGFACE_REPO = config_data.get("huggingface_repo", "HakuDevon/Dog_Breed_ID")
        self.LABELS_PATH = config_data.get("labels_path", "labels.json") # THÊM

        print("✅ Configuration applied:")
        print(f"   - Model Path: {self.MODEL_PATH}")
        print(f"   - Labels Path: {self.LABELS_PATH}")
        print(f"   - Device: {self.DEVICE}")
        print(f"   - HuggingFace Repo: {self.HUGGINGFACE_REPO}")
        print(f"   - Image Confidence: {self.IMAGE_CONF_THRESHOLD}")

        model_dir = os.path.dirname(self.MODEL_PATH)
        if model_dir and not os.path.exists(model_dir):
            os.makedirs(model_dir)

        # --- Download model if it doesn't exist ---
        if not os.path.exists(self.MODEL_PATH) and self.HUGGINGFACE_REPO:
            self.download_model()

        # Tải file labels nếu chưa có
        if not os.path.exists(self.LABELS_PATH) and self.HUGGINGFACE_REPO:
            self.download_labels()

        # --- Reload the model with the new path and device ---
        try:
            print(f"Loading model from path: {self.MODEL_PATH} onto device: {self.DEVICE}")
            self.model = YOLO(self.MODEL_PATH) 
            self.model.to(self.DEVICE)
            
            # Tải lại tên class từ file labels.json nếu có
            if os.path.exists(self.LABELS_PATH):
                with open(self.LABELS_PATH, 'r') as f:
                    labels_data = json.load(f)
                    # Giả sử file json có dạng {"0": "class_a", "1": "class_b"}
                    # hoặc là một list ["class_a", "class_b"]
                    self.model.names = labels_data.get('names', self.model.names)
                print(f"✅ Custom labels loaded from {self.LABELS_PATH}")

            print("✅ YOLO model loaded/reloaded successfully.")

        except Exception as e:
            print(f"FATAL: Error loading YOLO model: {e}")
            self.model = None

    def download_model(self):
        from huggingface_hub import hf_hub_download
        print(f"Model not found at {self.MODEL_PATH}. Downloading from Hugging Face...")
        try:
            hf_hub_download(repo_id=self.HUGGINGFACE_REPO, filename=os.path.basename(self.MODEL_PATH), local_dir=os.path.dirname(self.MODEL_PATH))
            print("Model downloaded successfully.")
        except Exception as e:
            print(f"Error downloading model from repo '{self.HUGGINGFACE_REPO}': {e}")
    
    def download_labels(self):
        from huggingface_hub import hf_hub_download
        print(f"Labels file not found at {self.LABELS_PATH}. Downloading from Hugging Face...")
        try:
            hf_hub_download(repo_id=self.HUGGINGFACE_REPO, filename=os.path.basename(self.LABELS_PATH), local_dir=os.path.dirname(self.LABELS_PATH) or '.')
            print("Labels file downloaded successfully.")
        except Exception as e:
            print(f"Error downloading labels file from repo '{self.HUGGINGFACE_REPO}': {e}")

    def set_defaults(self):
        self.IMAGE_CONF_THRESHOLD = 0.25
        self.VIDEO_CONF_THRESHOLD = 0.5
        self.STREAM_CONF_THRESHOLD = 0.4
        self.STREAM_HIGH_CONF_THRESHOLD = 0.8
        self.DEVICE = "cpu"
        self.MODEL_PATH = "models/epoch90.pt"
        self.HUGGINGFACE_REPO = "HakuDevon/Dog_Breed_ID"
        self.LABELS_PATH = "labels.json"


# Define the save directory relative to this script's location
SAVE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "public", "processed-images")
)


# ==============================================================================
# 2. INITIALIZATION
# ==============================================================================
app = FastAPI(
    title="Dog Breed Inference API",
    description="An API to predict dog breeds from images, videos and streams using a YOLOv8 model.",
    version="6.0.0",
)

config = Config() 

os.makedirs(SAVE_DIR, exist_ok=True)
print(f"Annotated frames will be saved to: {SAVE_DIR}")

# ==============================================================================
# 3. HELPER FUNCTIONS
# ==============================================================================


def process_results(results) -> List[Dict[str, Any]]:
    """
    Processes detection or tracking results and returns a structured list of detections.
    Includes track_id if available.
    """
    detections = []
    
    if not config.model:
        print("Error: Model not loaded in process_results")
        return detections
        
    if not results or not results[0].boxes:
        return detections

    boxes = results[0].boxes
    track_ids = (
        boxes.id.int().cpu().tolist() if boxes.id is not None else [None] * len(boxes)
    )
    class_ids = boxes.cls.int().cpu().tolist()
    confs = boxes.conf.float().cpu().tolist()
    xyxy_coords = boxes.xyxy.cpu().tolist()

    for track_id, class_id, conf, xyxy in zip(track_ids, class_ids, confs, xyxy_coords):
        detections.append(
            {
                "track_id": track_id,
                "class_id": class_id,
                "class": config.model.names[class_id], 
                "confidence": conf,
                "box": [round(coord) for coord in xyxy],
            }
        )
    return detections


def draw_custom_annotations(frame, detections: List[Dict[str, Any]]):
    """
    Draws bounding boxes and labels on a frame using Ultralytics' Annotator
    to achieve the default look and feel, but with the track_id included.
    """
    annotated_frame = frame.copy()
    
    if not config.model:
        return annotated_frame
        
    annotator = Annotator(annotated_frame, line_width=2, example=str(config.model.names))

    for det in detections:
        box = det["box"]
        confidence = det["confidence"]
        class_name = det["class"]
        class_id = det["class_id"]
        track_id = det.get("track_id")

        # Xây dựng nhãn bao gồm cả track_id
        label = f"{class_name} {confidence:.2f}"
        if track_id is not None:
            label = f"ID:{track_id} {label}"

        # Sử dụng annotator của ultralytics để vẽ
        annotator.box_label(box, label, color=colors(class_id, True))

    return annotator.result()


# ==============================================================================
# 4. API ENDPOINTS
# ==============================================================================


@app.get("/", summary="Health Check")
def health_check():
    """Provides a simple health check endpoint."""
    return JSONResponse(
        content={"status": "ok", "message": "YOLOv8 Inference Service is running."}
    )

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

@app.post("/predict/image", summary="Predict from a single image")
async def predict_from_image_file(file: UploadFile = File(...)):
    """
    Accepts an image file, returns predictions (with track_id) and a base64 annotated image.
    """
    if not config.model: 
        return JSONResponse(
            content={"status": "error", "message": "Model is not loaded"},
            status_code=503,
        )
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return JSONResponse(
                content={"status": "error", "message": "Could not decode image."},
                status_code=400,
            )

        # Use model.track() to get track_id even for a single image
        results = config.model.track( 
            source=img, conf=config.IMAGE_CONF_THRESHOLD, persist=False, verbose=False
        )
        detections = process_results(results)

        annotated_image = draw_custom_annotations(img, detections)
        _, buffer = cv2.imencode(".jpg", annotated_image)
        processed_image_base64 = base64.b64encode(buffer).decode("utf-8")

        return JSONResponse(
            content={
                "predictions": sorted(
                    detections, key=lambda x: x["confidence"], reverse=True
                ),
                "processed_media_base64": processed_image_base64,
                "media_type": "image/jpeg",
            }
        )
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            content={
                "status": "error",
                "message": f"An internal error occurred: {str(e)}",
            },
            status_code=500,
        )

@app.post("/predict/images", summary="Predict from a batch of images")
async def predict_from_image_batch(files: List[UploadFile] = File(...)):
    """
    Accepts a batch of image files, returns a list of predictions and annotated images.
    This is more efficient for processing multiple images at once.
    """
    if not config.model: 
        return JSONResponse(
            content={"status": "error", "message": "Model is not loaded"},
            status_code=503,
        )

    images = []
    original_files = []
    
    # Files are automatically cleaned up by FastAPI's UploadFile mechanism
    for file in files:
        try:
            contents = await file.read()
            nparr = np.frombuffer(contents, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is not None:
                images.append(img)
                original_files.append(file.filename)
            else:
                print(f"Warning: Could not decode image {file.filename}")
        except Exception as e:
            print(f"Warning: Error processing file {file.filename}: {e}")

    if not images:
        return JSONResponse(
            content={"status": "error", "message": "No valid images were provided."},
            status_code=400,
        )

    try:
        # Process the entire batch of images in one go
        results_list = config.model.track( 
            source=images, conf=config.IMAGE_CONF_THRESHOLD, persist=False, verbose=False
        )

        response_data = []
        for i, results in enumerate(results_list):
            # process_results expects a list containing one result object
            detections = process_results([results])
            annotated_image = draw_custom_annotations(images[i], detections)
            _, buffer = cv2.imencode(".jpg", annotated_image)
            processed_image_base64 = base64.b64encode(buffer).decode("utf-8")

            response_data.append({
                "original_filename": original_files[i],
                "predictions": sorted(detections, key=lambda x: x["confidence"], reverse=True),
                "processed_media_base64": processed_image_base64,
                "media_type": "image/jpeg",
            })

        return JSONResponse(content={"results": response_data})

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            content={"status": "error", "message": f"An internal error occurred during batch processing: {str(e)}"},
            status_code=500,
        )
@app.post(
    "/predict/video",
    summary="Process a video, return annotated video and best shot JSON",
)
async def predict_from_video_file(file: UploadFile = File(...)):
    if not config.model: 
        return JSONResponse(
            content={"status": "error", "message": "Model is not loaded"},
            status_code=503,
        )

    tmp_in_path = ""
    tmp_out_path = ""
    cap = None
    video_writer = None

    try:
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=".mp4"
        ) as tmp_in, tempfile.NamedTemporaryFile(
            delete=False, suffix=".mp4"
        ) as tmp_out:
            # FIX: Video files must be saved to disk for OpenCV/YOLO to stream from them reliably
            contents = await file.read()
            tmp_in.write(contents)
            tmp_in_path = tmp_in.name
            tmp_out_path = tmp_out.name

        cap = cv2.VideoCapture(tmp_in_path)
        if not cap.isOpened():
            return JSONResponse(
                content={"status": "error", "message": "Could not open video file."},
                status_code=400,
            )

        # 1. Lấy kích thước gốc
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)

        # 2. Đảm bảo kích thước là số chẵn (rất quan trọng cho codec H.264)
        processed_width = width - (width % 2)
        processed_height = height - (height % 2)

        print(f"Original dims: {width}x{height}. Processing at: {processed_width}x{processed_height}")

        video_writer = imageio.get_writer(
            tmp_out_path,
            fps=fps,
            codec="libx264",
            pixelformat="yuv420p",
            macro_block_size=1  # FIX: Chấp nhận mọi kích thước video, không yêu cầu chia hết cho 16.
        )

        tracked_objects = {}

        results_generator = config.model.track( 
            source=tmp_in_path,

            conf=config.VIDEO_CONF_THRESHOLD,
            persist=True,
            verbose=False,
            tracker=TRACKER_CONFIG,
            stream=True,
        )

        frame_count = 0
        for results in results_generator:
            frame = results.orig_img # Sử dụng trực tiếp frame gốc từ YOLO

            detections = process_results(results)

            if results.boxes.id is not None:
                for det in detections:
                    track_id = det["track_id"]
                    if track_id is None:
                        continue
                    confidence = det["confidence"]
                    if (
                        track_id not in tracked_objects
                        or confidence > tracked_objects[track_id]["confidence"]
                    ):
                        tracked_objects[track_id] = det

            annotated_frame = draw_custom_annotations(frame, detections)
            rgb_frame = cv2.cvtColor(annotated_frame, cv2.COLOR_BGR2RGB)
            video_writer.append_data(rgb_frame)
            frame_count += 1
        
        print(f"Processed and wrote {frame_count} frames to video.")

        # Đóng video writer để đảm bảo tất cả dữ liệu được ghi xuống file
        video_writer.close()
        video_writer = None 
        cap.release()
        cap = None 

        final_predictions = list(tracked_objects.values())

        with open(tmp_out_path, "rb") as video_file:
            processed_video_base64 = base64.b64encode(video_file.read()).decode("utf-8")

        return JSONResponse(
            content={
                "predictions": sorted(
                    final_predictions, key=lambda x: x.get("track_id", 0)
                ),
                "processed_media_base64": processed_video_base64,
                "media_type": "video/mp4",
            }
        )

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            content={
                "status": "error",
                "message": f"An internal error occurred: {str(e)}",
            },
            status_code=500,
        )
    finally:
        if cap is not None:
            cap.release()
        if video_writer is not None:
            video_writer.close()
        
        # Đảm bảo xóa file tạm
        if tmp_in_path and os.path.exists(tmp_in_path):
            os.unlink(tmp_in_path)
        if tmp_out_path and os.path.exists(tmp_out_path):
            os.unlink(tmp_out_path)

@app.websocket("/predict-stream")
async def predict_stream(websocket: WebSocket):
    """
    Real-time prediction via WebSocket. Uses tracking to maintain object IDs across frames.
    Returns a JSON object with base64 annotated image upon high-confidence capture.
    """
    await websocket.accept()
    if not config.model: 
        await websocket.send_json({"status": "error", "message": "Model is not loaded"})
        await websocket.close()
        return

    try:
        while True:
            # --- THAY ĐỔI: Sử dụng receive() để xử lý message an toàn hơn ---
            message = await websocket.receive()
            
            if message["type"] == "websocket.disconnect":
                raise WebSocketDisconnect(message.get("code", 1000))

            data = message.get("text", "")

            if not data.startswith('data:image'):
                if data: print(f"[WS] Received non-image data, skipping: {data[:50]}...")
                continue

            img_data = base64.b64decode(data.split(",")[1])            
            nparr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is not None:
                results = config.model.track( 
                    source=img, 
                    conf=config.STREAM_CONF_THRESHOLD, 
                    persist=True, 
                    verbose=False,
                    tracker=TRACKER_CONFIG
                )
                detections = process_results(results)

                high_conf_detections = [
                    d
                    for d in detections
                    if d["confidence"] > config.STREAM_HIGH_CONF_THRESHOLD
                ]

                if high_conf_detections:

                    best_det = max(high_conf_detections, key=lambda x: x["confidence"])
                    
                    annotated_frame = draw_custom_annotations(img, high_conf_detections)

                    _, buffer = cv2.imencode(".jpg", annotated_frame)
                    processed_image_base64 = base64.b64encode(buffer).decode("utf-8")
                    
                    prediction_id = str(uuid.uuid4())

                    # track_id = best_det.get("track_id", "N/A")
                    # breed_name = best_det["class"].replace(" ", "_")
                    # filename = f"capture_ws_{track_id}_{breed_name}_{uuid.uuid4().hex[:6]}.jpg"
                    # save_path = os.path.join(SAVE_DIR, filename)
                    # cv2.imwrite(save_path, annotated_frame) # <--- BỎ DÒNG NÀY
                    print(f"[WS] Captured high-confidence dog detection: {best_det}")

                    response_payload = {
                        "status": "captured", 
                        "predictionId": prediction_id, 
                        "processed_media_base64": processed_image_base64,
                        "media_type": "image/jpeg", 
                        "detections": high_conf_detections,
                    }
                    
                    await websocket.send_json(response_payload)
                    break 
                else:
                    await websocket.send_json({"detections": detections})
            else:
                print("[WS] ERROR: Received data could not be decoded into an image.")
                await websocket.send_json({"status": "waiting"})
    except WebSocketDisconnect:
        print("[WS] Client disconnected.")
    except Exception as e:
        print(f"WebSocket Error: {e}")
        traceback.print_exc()
        try:
            await websocket.send_json({"status": "error", "message": f"Server error: {str(e)}"})
            await websocket.close(1001)
        except RuntimeError:
            pass

# ==============================================================================
# 5. SERVER RUN
# ==============================================================================

if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8000)