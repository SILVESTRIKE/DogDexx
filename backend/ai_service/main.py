import uvicorn
from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from ultralytics import YOLO
import cv2
import numpy as np
import tempfile
import os
import uuid
import base64
import traceback
import asyncio
import imageio  # Thêm thư viện imageio
from typing import List, Dict, Any
from ultralytics.utils.plotting import Annotator, colors

# ==============================================================================
# 1. CONFIGURATION
# ==============================================================================
MODEL_PATH = "best_model.pt"
DEVICE = "cuda"
IMAGE_CONF_THRESHOLD = 0.25
VIDEO_CONF_THRESHOLD = 0.5
STREAM_CONF_THRESHOLD = 0.4
STREAM_HIGH_CONF_THRESHOLD = 0.8
TRACKER_CONFIG = "bytetrack.yaml"

# Define the save directory relative to this script's location
SAVE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "public", "processed-images")
)


# ==============================================================================
# 2. INITIALIZATION
# ==============================================================================
app = FastAPI(
    title="Dog Breed Inference API",
    description="An API to predict dog breeds from images and videos using a YOLOv8 model.",
    version="6.0.0",
)

try:
    model = YOLO(MODEL_PATH)
    model.to(DEVICE)
    print("YOLO model loaded successfully.")
except Exception as e:
    print(f"Error loading YOLO model: {e}")
    model = None

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
                "class": model.names[class_id],
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
    annotator = Annotator(annotated_frame, line_width=2, example=str(model.names))

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
        # annotator.box_label sẽ tự động xử lý màu sắc, vị trí văn bản, v.v.
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


@app.post("/predict/image", summary="Predict from a single image")
async def predict_from_image_file(file: UploadFile = File(...)):
    """
    Accepts an image file, returns predictions (with track_id) and a base64 annotated image.
    """
    if not model:
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
        results = model.track(
            source=img, conf=IMAGE_CONF_THRESHOLD, persist=False, verbose=False
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
    if not model:
        return JSONResponse(
            content={"status": "error", "message": "Model is not loaded"},
            status_code=503,
        )

    images = []
    original_files = []
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
        results_list = model.track(
            source=images, conf=IMAGE_CONF_THRESHOLD, persist=False, verbose=False
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
    if not model:
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

        # === THAY ĐỔI BẮT ĐẦU TỪ ĐÂY ===

        # 1. Lấy kích thước gốc
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)

        # 2. Đảm bảo kích thước là số chẵn (quan trọng cho codec H.264)
        processed_width = width - (width % 2)
        processed_height = height - (height % 2)
        
        print(f"Original dims: {width}x{height}. Processing at: {processed_width}x{processed_height}")

        # === KẾT THÚC THAY ĐỔI ===

        video_writer = imageio.get_writer(
            tmp_out_path,
            fps=fps,
            codec="libx264",
            pixelformat="yuv420p"
            # Không cần macro_block_size nữa khi kích thước đã là số chẵn
        )

        tracked_objects = {}

        results_generator = model.track(
            source=tmp_in_path,
            conf=VIDEO_CONF_THRESHOLD,
            persist=True,
            verbose=False,
            tracker=TRACKER_CONFIG,
            stream=True,
        )

        frame_count = 0
        for results in results_generator:
            frame = results.orig_img
            
            # === THAY ĐỔI: Resize frame nếu cần thiết ===
            if frame.shape[1] != processed_width or frame.shape[0] != processed_height:
                frame = cv2.resize(frame, (processed_width, processed_height))
            # === KẾT THÚC THAY ĐỔI ===

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
        # trước khi đọc nó lên
        video_writer.close()
        video_writer = None # Set to None để finally không close lần nữa
        cap.release()
        cap = None # Set to None

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
        
        # Để gỡ lỗi, bạn có thể tạm thời comment 2 dòng unlink dưới đây
        # để kiểm tra file video được tạo ra trong thư mục C:\Users\vandu\AppData\Local\Temp
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
    if not model:
        await websocket.send_json({"status": "error", "message": "Model is not loaded"})
        await websocket.close()
        return

    try:
        while True:
            data = await websocket.receive_text()
            img_data = base64.b64decode(data.split(",")[1])
            nparr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is not None:
                results = model.track(
                    source=img, conf=STREAM_CONF_THRESHOLD, persist=True, verbose=False
                )
                detections = process_results(results)

                high_conf_detections = [
                    d
                    for d in detections
                    if d["confidence"] > STREAM_HIGH_CONF_THRESHOLD
                ]

                if high_conf_detections:

                    # 1. Vẽ chú thích lên khung hình
                    annotated_frame = draw_custom_annotations(img, high_conf_detections)

                    # 2. Mã hóa ảnh đã chú thích sang base64
                    _, buffer = cv2.imencode(".jpg", annotated_frame)
                    processed_image_base64 = base64.b64encode(buffer).decode("utf-8")

                    # 3. Xây dựng payload mới bao gồm cả ảnh base64 và detections
                    response_payload = {
                        "status": "captured",
                        "processed_media_base64": processed_image_base64,
                        "media_type": "image/jpeg",
                        "detections": high_conf_detections,
                    }
                    
                    best_det = max(high_conf_detections, key=lambda x: x["confidence"])
                    track_id = best_det.get("track_id", "N/A")
                    breed_name = best_det["class"].replace(" ", "_")
                    filename = f"capture_ws_{track_id}_{breed_name}_{uuid.uuid4().hex[:6]}.jpg"
                    save_path = os.path.join(SAVE_DIR, filename)
                    cv2.imwrite(save_path, annotated_frame)
                    print(f"[WS] Captured high-confidence frame: {save_path}")

                    await websocket.send_json(response_payload)
                    await asyncio.sleep(0.1)
                    await websocket.close()
                    break 

                else:
                    await websocket.send_json(
                        {"status": "ok", "detections": detections}
                    )
            else:
                print("[WS] ERROR: Received data could not be decoded into an image.")

    except WebSocketDisconnect:
        print("[WS] Client disconnected.")
    except Exception as e:
        print(f"WebSocket Error: {e}")
        traceback.print_exc()
        try:
            await websocket.close()
        except RuntimeError:
            pass

# ==============================================================================
# 5. SERVER RUN
# ==============================================================================

if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8000)
