import os
import re
from typing import Any, Dict, List, Optional, Tuple

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv


app = FastAPI(title="Roboflow Proxy", version="1.0.0")

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


class DetectRequest(BaseModel):
    image_base64: str
    conf: Optional[float] = None
    classes: Optional[str] = None


def _env(name: str, default: str = "") -> str:
    return str(os.getenv(name, default) or "").strip()


def _strip_data_url(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if raw.startswith("data:"):
        parts = raw.split(",", 1)
        if len(parts) == 2:
            return parts[1].strip()
    return raw


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        n = float(value)
        if n != n:
            return default
        return n
    except Exception:
        return default


def _normalize_prediction(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not isinstance(item, dict):
        return None

    class_name = str(item.get("class") or item.get("class_name") or "").strip()
    if not class_name:
        return None

    x = _to_float(item.get("x"), 0.0)
    y = _to_float(item.get("y"), 0.0)
    w = _to_float(item.get("width"), 0.0)
    h = _to_float(item.get("height"), 0.0)
    confidence = _to_float(item.get("confidence"), 0.0)

    x1 = x - w / 2
    y1 = y - h / 2
    x2 = x + w / 2
    y2 = y + h / 2

    return {
        "class_name": class_name,
        "confidence": confidence,
        "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
    }


def _bbox_from_points(points: Any) -> Optional[Tuple[float, float, float, float]]:
    if not isinstance(points, list) or len(points) == 0:
        return None
    xs: List[float] = []
    ys: List[float] = []
    for p in points:
        if not isinstance(p, dict):
            continue
        x = _to_float(p.get("x"), float("nan"))
        y = _to_float(p.get("y"), float("nan"))
        if x == x and y == y:
            xs.append(x)
            ys.append(y)
    if len(xs) == 0 or len(ys) == 0:
        return None
    return (min(xs), min(ys), max(xs), max(ys))


def _normalize_prediction_any(item: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(item, dict):
        return None

    if "points" in item:
        class_name = str(item.get("class") or item.get("class_name") or "").strip()
        if not class_name:
            return None
        confidence = _to_float(item.get("confidence"), 0.0)
        bbox = _bbox_from_points(item.get("points"))
        if not bbox:
            return None
        x1, y1, x2, y2 = bbox
        return {
            "class_name": class_name,
            "confidence": confidence,
            "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
        }

    return _normalize_prediction(item)


def _find_predictions(obj: Any) -> List[Dict[str, Any]]:
    queue: List[Any] = [obj]
    visited: set[int] = set()
    while len(queue) > 0:
        cur = queue.pop(0)
        if cur is None:
            continue
        if isinstance(cur, (dict, list)):
            obj_id = id(cur)
            if obj_id in visited:
                continue
            visited.add(obj_id)
        if isinstance(cur, dict):
            if isinstance(cur.get("predictions"), list):
                return cur.get("predictions")  # type: ignore[return-value]
            for v in cur.values():
                if isinstance(v, (dict, list)):
                    queue.append(v)
        elif isinstance(cur, list):
            if len(cur) > 0 and all(isinstance(x, dict) for x in cur):
                if any(("class" in x or "class_name" in x) for x in cur):
                    return cur  # type: ignore[return-value]
            for v in cur:
                if isinstance(v, (dict, list)):
                    queue.append(v)
    return []


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {"ok": True}


@app.post("/detect")
async def detect(payload: DetectRequest) -> Dict[str, Any]:
    api_key = _env("ROBOFLOW_API_KEY")
    model_id = _env("ROBOFLOW_MODEL_ID")
    workflow_workspace = _env("ROBOFLOW_WORKFLOW_WORKSPACE")
    workflow_id = _env("ROBOFLOW_WORKFLOW_ID")
    api_url = _env("ROBOFLOW_API_URL", "https://serverless.roboflow.com").rstrip("/")
    timeout_sec = max(5.0, _to_float(_env("ROBOFLOW_TIMEOUT_SEC", "20"), 20.0))

    if not api_key:
        raise HTTPException(status_code=500, detail="ROBOFLOW_API_KEY belum diatur.")

    image_b64 = _strip_data_url(payload.image_base64)
    if not image_b64:
        raise HTTPException(status_code=400, detail="image_base64 wajib diisi.")

    conf = payload.conf
    if conf is None:
        conf = _to_float(_env("ROBOFLOW_DEFAULT_CONF", "0.4"), 0.4)
    conf = max(0.0, min(1.0, float(conf)))

    if workflow_workspace and workflow_id:
        url = f"{api_url}/{workflow_workspace}/workflows/{workflow_id}"
        body = {
            "api_key": api_key,
            "inputs": {
                "image": {"type": "base64", "value": image_b64},
                "classes": payload.classes or _env("ROBOFLOW_WORKFLOW_CLASSES", "fokus, tidak fokus"),
            },
        }
        headers = {"Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=timeout_sec) as client:
            try:
                resp = await client.post(url, json=body, headers=headers)
            except Exception as exc:
                raise HTTPException(status_code=502, detail=f"Gagal menghubungi Roboflow: {exc}")

        if resp.status_code >= 400:
            message = ""
            try:
                data = resp.json()
                message = str(data.get("message") or data.get("error") or "")
            except Exception:
                message = resp.text[:500]
            raise HTTPException(status_code=resp.status_code, detail=message or f"Roboflow error ({resp.status_code})")

        data = resp.json()
        predictions = _find_predictions(data)
        normalized: List[Dict[str, Any]] = []
        if isinstance(predictions, list):
            for item in predictions:
                norm = _normalize_prediction_any(item)
                if norm:
                    normalized.append(norm)

        return {
            "success": True,
            "provider": "roboflow-workflow-api",
            "workflow": f"{workflow_workspace}/{workflow_id}",
            "confidence": conf,
            "detections": normalized,
            "raw_prediction_count": len(predictions) if isinstance(predictions, list) else 0,
            "filtered_prediction_count": len(normalized),
        }

    if not model_id:
        raise HTTPException(status_code=500, detail="ROBOFLOW_MODEL_ID belum diatur (format: project/version) atau set ROBOFLOW_WORKFLOW_WORKSPACE + ROBOFLOW_WORKFLOW_ID.")

    url = f"{api_url}/{model_id}"
    params = {"api_key": api_key, "confidence": conf}

    headers = {"Content-Type": "application/x-www-form-urlencoded"}

    async with httpx.AsyncClient(timeout=timeout_sec) as client:
        try:
            resp = await client.post(url, params=params, content=image_b64, headers=headers)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Gagal menghubungi Roboflow: {exc}")

    if resp.status_code >= 400:
        message = ""
        try:
            data = resp.json()
            message = str(data.get("message") or data.get("error") or "")
        except Exception:
            message = resp.text[:500]
        raise HTTPException(status_code=resp.status_code, detail=message or f"Roboflow error ({resp.status_code})")

    data = resp.json()
    predictions = data.get("predictions")
    normalized: List[Dict[str, Any]] = []
    if isinstance(predictions, list):
        for item in predictions:
            norm = _normalize_prediction_any(item)
            if norm:
                normalized.append(norm)

    return {
        "success": True,
        "provider": "roboflow-model-api",
        "model_id": model_id,
        "confidence": conf,
        "detections": normalized,
        "raw_prediction_count": len(predictions) if isinstance(predictions, list) else 0,
        "filtered_prediction_count": len(normalized),
    }
