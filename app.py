from datetime import datetime
from pathlib import Path
from threading import Lock

import cv2
from flask import Flask, Response, jsonify, render_template

from utils.detector import FaceDetector


app = Flask(__name__)

camera = None
camera_lock = Lock()
detector = FaceDetector()
detection_running = False
last_stats = {
    "faces": 0,
    "fps": 0,
    "confidence": 0,
    "camera": "Camera Off",
}


def get_camera():
    """Open the webcam only when it is needed."""
    global camera

    with camera_lock:
        if camera is None or not camera.isOpened():
            camera = cv2.VideoCapture(0)
            camera.set(cv2.CAP_PROP_FRAME_WIDTH, 960)
            camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 540)
        return camera


def release_camera():
    """Release camera safely so another app can use it."""
    global camera

    with camera_lock:
        if camera is not None:
            camera.release()
            camera = None


def generate_frames():
    """Send webcam frames to the browser as a MJPEG stream."""
    global last_stats

    video = get_camera()

    while True:
        success, frame = video.read()
        if not success:
            break

        if detection_running:
            frame, stats = detector.detect(frame)
        else:
            stats = {
                "faces": 0,
                "fps": 0,
                "confidence": 0,
                "camera": "Camera Active",
            }

        last_stats = stats

        encoded, buffer = cv2.imencode(".jpg", frame)
        if not encoded:
            continue

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"
        )


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/video_feed")
def video_feed():
    return Response(
        generate_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@app.route("/start")
def start_detection():
    global detection_running
    detection_running = True
    get_camera()
    last_stats["camera"] = "Camera Active"
    return jsonify({"message": "Detection started", "status": last_stats})


@app.route("/stop")
def stop_detection():
    global detection_running
    detection_running = False
    release_camera()
    last_stats.update({"faces": 0, "fps": 0, "confidence": 0, "camera": "Camera Off"})
    return jsonify({"message": "Detection stopped", "status": last_stats})


@app.route("/capture")
def capture_image():
    video = get_camera()
    success, frame = video.read()

    if not success:
        return jsonify({"message": "Could not capture image"}), 500

    if detection_running:
        frame, _ = detector.detect(frame)

    captures_folder = Path("static/images")
    captures_folder.mkdir(parents=True, exist_ok=True)

    filename = f"capture_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
    file_path = captures_folder / filename
    cv2.imwrite(str(file_path), frame)

    return jsonify({
        "message": "Image captured",
        "image": f"/static/images/{filename}",
    })


@app.route("/stats")
def stats():
    return jsonify(last_stats)


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
