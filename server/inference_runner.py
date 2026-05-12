import os
import json
import time
import base64
import threading
from typing import Any, Dict, List, Optional

import requests
from flask import Flask, jsonify, request


app = Flask(__name__)

current_pipeline = None
pipeline_thread = None
active_session_id: Optional[str] = None
pipeline_state: str = "idle"
pipeline_error: str = ""
terminate_requested: bool = False
last_prediction_ms: int = 0
last_prediction_count: int = 0
last_frame_post_ms: int = 0

latest_frame_by_session: Dict[str, Dict[str, Any]] = {}
seat_stats: Dict[str, Dict[str, int]] = {}
lock = threading.Lock()


def _load_dotenv(dotenv_path: str) -> None:
    try:
        if not dotenv_path or not os.path.exists(dotenv_path):
            return
        with open(dotenv_path, "r", encoding="utf-8") as f:
            for raw_line in f:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip("'").strip('"')
                if not key:
                    continue
                os.environ.setdefault(key, value)
    except Exception:
        return


_load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))


def _env(name: str, default: str = "") -> str:
    val = os.environ.get(name)
    if val is None:
        return default
    return str(val)


def _split_set(value: str) -> set:
    return {v.strip().lower() for v in (value or "").split(",") if v.strip()}


ROBOFLOW_API_KEY = _env("ROBOFLOW_API_KEY", "")
MODEL_ID = _env("ROBOFLOW_MODEL_ID", "")
EXPRESS_URL = _env("EXPRESS_URL", "http://127.0.0.1:5002")

FOCUS_CLASSES = _split_set(_env("FOCUS_CLASSES", "memperhatikan,focused"))
NONFOCUS_CLASSES = _split_set(_env("NONFOCUS_CLASSES", "tidur,menggunakan ponsel,phone,main_hp,balikbadan,chatting"))


def _require_deps():
    try:
        import cv2  # noqa: F401
        import numpy as np  # noqa: F401
        from inference import InferencePipeline  # noqa: F401
        from inference.core.interfaces.camera.entities import VideoFrame  # noqa: F401
    except Exception as e:
        raise RuntimeError(
            "Missing Python dependencies for InferencePipeline. Install: pip install inference inference-sdk opencv-python numpy"
        ) from e


def _draw_predictions(frame_bgr, predictions_list: List[dict]):
    import cv2

    h, w = frame_bgr.shape[:2]
    for pred in predictions_list:
        cls = str(pred.get("class", "")).strip()
        cls_norm = cls.lower()
        conf = float(pred.get("confidence", 0.0) or 0.0)

        cx = float(pred.get("x", 0.0) or 0.0)
        cy = float(pred.get("y", 0.0) or 0.0)
        pw = float(pred.get("width", 0.0) or 0.0)
        ph = float(pred.get("height", 0.0) or 0.0)

        x1 = int(max(0, min(w - 1, cx - pw / 2.0)))
        y1 = int(max(0, min(h - 1, cy - ph / 2.0)))
        x2 = int(max(0, min(w - 1, cx + pw / 2.0)))
        y2 = int(max(0, min(h - 1, cy + ph / 2.0)))

        if cls_norm in FOCUS_CLASSES:
            color = (34, 197, 94)
        elif cls_norm in NONFOCUS_CLASSES:
            color = (239, 68, 68)
        else:
            color = (59, 130, 246)

        cv2.rectangle(frame_bgr, (x1, y1), (x2, y2), color, 2)
        label = f"{cls} {conf:.2f}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
        ty1 = max(0, y1 - th - 8)
        cv2.rectangle(frame_bgr, (x1, ty1), (x1 + tw + 6, ty1 + th + 6), color, -1)
        cv2.putText(frame_bgr, label, (x1 + 3, ty1 + th + 2), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 2)

    return frame_bgr


def _annotate_and_encode_jpeg(frame_bgr, predictions: dict, jpeg_quality: int = 72) -> str:
    import cv2

    raw_preds = predictions.get("predictions", []) or []
    annotated = _draw_predictions(frame_bgr.copy(), raw_preds)

    ok, buffer = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), int(jpeg_quality)])
    if not ok:
        raise RuntimeError("Failed to encode frame")
    return base64.b64encode(buffer.tobytes()).decode("utf-8")


def _record_seat_status(predictions_list: List[dict], seats: List[dict]):
    with lock:
        for seat in seats:
            seat_id = str(seat.get("id") or seat.get("seat_id") or "")
            if not seat_id:
                continue

            sx = float(seat.get("x", 0.0) or 0.0)
            sy = float(seat.get("y", 0.0) or 0.0)
            sw = float(seat.get("w", seat.get("width", 0.0)) or 0.0)
            sh = float(seat.get("h", seat.get("height", 0.0)) or 0.0)

            if seat_id not in seat_stats:
                seat_stats[seat_id] = {"fokus": 0, "tidak_fokus": 0}

            seat_is_focused = True
            for pred in predictions_list:
                cls = str(pred.get("class", "")).strip().lower()
                cx = float(pred.get("x", 0.0) or 0.0)
                cy = float(pred.get("y", 0.0) or 0.0)
                pw = float(pred.get("width", 0.0) or 0.0)
                ph = float(pred.get("height", 0.0) or 0.0)

                px = cx - pw / 2.0
                py = cy - ph / 2.0

                ix1 = max(sx, px)
                iy1 = max(sy, py)
                ix2 = min(sx + sw, px + pw)
                iy2 = min(sy + sh, py + ph)
                if ix2 <= ix1 or iy2 <= iy1:
                    continue

                overlap_area = (ix2 - ix1) * (iy2 - iy1)
                pred_area = pw * ph
                if pred_area <= 0:
                    continue

                if (overlap_area / pred_area) > 0.3:
                    if cls in NONFOCUS_CLASSES:
                        seat_is_focused = False
                        break

            if seat_is_focused:
                seat_stats[seat_id]["fokus"] += 1
            else:
                seat_stats[seat_id]["tidak_fokus"] += 1


def _build_sink(seats: List[dict], record_interval: int, session_id: str, jpeg_quality: int = 72):
    last_record = [time.time()]

    def sink(predictions: dict, video_frame) -> None:
        raw_preds = predictions.get("predictions", []) or []
        now_ms = int(time.time() * 1000)
        with lock:
            global last_prediction_ms, last_prediction_count
            last_prediction_ms = now_ms
            last_prediction_count = len(raw_preds)

        try:
            frame = video_frame.image
            frame_b64 = _annotate_and_encode_jpeg(frame, predictions, jpeg_quality=jpeg_quality)
            payload = {"session_id": session_id, "frame": frame_b64, "predictions": raw_preds, "timestamp": int(time.time() * 1000)}
            try:
                requests.post(f"{EXPRESS_URL}/live-monitoring/frame", json=payload, timeout=0.5)
                with lock:
                    global last_frame_post_ms
                    last_frame_post_ms = now_ms
            except Exception:
                pass
        except Exception:
            pass

        now = time.time()
        if now - last_record[0] >= float(record_interval):
            last_record[0] = now
            try:
                _record_seat_status(raw_preds, seats)
            except Exception:
                pass

    return sink


def start_pipeline(camera_index: int, seats: List[dict], session_id: str, confidence: float = 0.5, max_fps: int = 10, record_interval: int = 5, jpeg_quality: int = 72):
    global current_pipeline, pipeline_thread, active_session_id, seat_stats, pipeline_state, pipeline_error, terminate_requested

    with lock:
        if pipeline_state in {"starting", "running"} or current_pipeline is not None:
            raise RuntimeError("Pipeline already running")
        pipeline_state = "starting"
        pipeline_error = ""
        terminate_requested = False
        active_session_id = session_id
        seat_stats = {}

    def run():
        global current_pipeline, pipeline_state, pipeline_error, terminate_requested
        try:
            _require_deps()
            if not ROBOFLOW_API_KEY:
                raise RuntimeError("ROBOFLOW_API_KEY is not set")
            if not MODEL_ID:
                raise RuntimeError("ROBOFLOW_MODEL_ID is not set (example: project/1)")

            from inference import InferencePipeline

            sink = _build_sink(seats=seats, record_interval=record_interval, session_id=session_id, jpeg_quality=jpeg_quality)

            pipeline = InferencePipeline.init(
                model_id=MODEL_ID,
                video_reference=int(camera_index),
                on_prediction=sink,
                api_key=ROBOFLOW_API_KEY,
                confidence=float(confidence),
                max_fps=int(max_fps),
            )

            with lock:
                if terminate_requested:
                    try:
                        pipeline.terminate()
                    except Exception:
                        pass
                    current_pipeline = None
                    pipeline_state = "idle"
                    return
                current_pipeline = pipeline
                pipeline_state = "running"

            try:
                pipeline.start()
                pipeline.join()
            finally:
                with lock:
                    current_pipeline = None
                    if pipeline_state == "running":
                        pipeline_state = "idle"
        except Exception as e:
            with lock:
                current_pipeline = None
                pipeline_state = "error"
                pipeline_error = str(e)

    pipeline_thread = threading.Thread(target=run, daemon=True)
    pipeline_thread.start()
    return {"status": "starting", "session_id": session_id}


def stop_pipeline(session_id: Optional[str] = None):
    global current_pipeline, active_session_id, pipeline_state, terminate_requested

    with lock:
        terminate_requested = True
        if current_pipeline is None and pipeline_state == "starting":
            pipeline_state = "idle"
            sid = session_id or active_session_id
            active_session_id = None
            return {"status": "stopped", "session_id": sid, "seat_results": {}, "summary": {"fokus": 0, "tidak_fokus": 0, "fokus_count": 0, "tidak_fokus_count": 0, "jumlah_hadir": 0}}

    if current_pipeline is None:
        return {"status": "stopped", "session_id": active_session_id, "seat_results": {}, "summary": {"fokus": 0, "tidak_fokus": 0, "fokus_count": 0, "tidak_fokus_count": 0, "jumlah_hadir": 0}}

    try:
        current_pipeline.terminate()
    except Exception:
        pass
    current_pipeline = None

    sid = session_id or active_session_id
    active_session_id = None

    with lock:
        results = {}
        clean_seats = 0
        total_seats = len(seat_stats)
        for seat_id, stats in seat_stats.items():
            focused = int(stats.get("tidak_fokus", 0) or 0) == 0
            if focused:
                clean_seats += 1
            results[seat_id] = {"fokus": int(stats.get("fokus", 0) or 0), "tidak_fokus": int(stats.get("tidak_fokus", 0) or 0), "focused": bool(focused)}
        focus_rate = round((clean_seats / total_seats) * 100) if total_seats > 0 else 0

    try:
        if sid and sid in latest_frame_by_session:
            del latest_frame_by_session[sid]
    except Exception:
        pass

    return {
        "status": "stopped",
        "session_id": sid,
        "seat_results": results,
        "summary": {
            "fokus": focus_rate,
            "tidak_fokus": max(0, 100 - focus_rate),
            "fokus_count": clean_seats,
            "tidak_fokus_count": max(0, total_seats - clean_seats),
            "jumlah_hadir": total_seats,
        },
    }


@app.route("/start", methods=["POST"])
def http_start():
    data = request.get_json() or {}
    result = start_pipeline(
        camera_index=int(data.get("camera_index", 0) or 0),
        seats=list(data.get("seats", []) or []),
        session_id=str(data.get("session_id") or "default"),
        confidence=float(data.get("confidence", 0.5) or 0.5),
        max_fps=int(data.get("max_fps", 10) or 10),
        record_interval=int(data.get("record_interval", 5) or 5),
        jpeg_quality=int(data.get("jpeg_quality", 72) or 72),
    )
    return jsonify(result)


@app.route("/stop", methods=["POST"])
def http_stop():
    data = request.get_json(silent=True) or {}
    sid = data.get("session_id")
    return jsonify(stop_pipeline(session_id=str(sid) if sid else None))


@app.route("/status", methods=["GET"])
def http_status():
    with lock:
        return jsonify(
            {
                "active": current_pipeline is not None,
                "session_id": active_session_id,
                "seat_stats": seat_stats,
                "pipeline_state": pipeline_state,
                "pipeline_error": pipeline_error,
                "last_prediction_ms": last_prediction_ms,
                "last_prediction_count": last_prediction_count,
                "last_frame_post_ms": last_frame_post_ms,
            }
        )


@app.route("/health", methods=["GET"])
def http_health():
    return jsonify({"status": "OK"})


@app.route("/api/model-info", methods=["GET"])
def http_model_info():
    try:
        artifacts_path = os.path.join(os.path.dirname(__file__), "uploads", "models", "model_artifacts.json")
        if not os.path.exists(artifacts_path):
            return jsonify({"success": False, "message": "model_artifacts.json not found"}), 200
        with open(artifacts_path, "r", encoding="utf-8") as f:
            data = json.load(f) or {}
        names_list = data.get("names", []) or []
        if not isinstance(names_list, list):
            names_list = []
        names = {str(i): str(n) for i, n in enumerate(names_list)}
        return jsonify({"success": True, "names": names, "num_classes": len(names_list)}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 200


if __name__ == "__main__":
    port = int(_env("INFERENCE_PORT", "5001"))
    app.run(host="0.0.0.0", port=port, debug=True)
