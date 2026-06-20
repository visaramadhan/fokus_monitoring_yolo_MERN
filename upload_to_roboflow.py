import os
import json
from roboflow import Roboflow


def _env(name: str, default: str = "") -> str:
    val = os.environ.get(name)
    return default if val is None else str(val)


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
                current = os.environ.get(key)
                if current is None or str(current).strip() in {"", "CHANGE_ME"}:
                    os.environ[key] = value
    except Exception:
        return


def _read_artifacts_model_type(model_dir: str) -> str:
    try:
        artifacts_path = os.path.join(model_dir, "model_artifacts.json")
        if not os.path.exists(artifacts_path):
            return ""
        with open(artifacts_path, "r", encoding="utf-8") as f:
            data = json.load(f) or {}
        mt = data.get("model_type")
        return str(mt).strip() if mt else ""
    except Exception:
        return ""


def main():
    repo_root = os.path.dirname(os.path.abspath(__file__))
    _load_dotenv(os.path.join(repo_root, "server", ".env"))

    api_key = _env("ROBOFLOW_API_KEY").strip()
    if not api_key or api_key == "CHANGE_ME":
        raise SystemExit("ROBOFLOW_API_KEY belum diset (atau masih CHANGE_ME). Isi di server/.env lalu jalankan ulang.")

    workspace_name = _env("ROBOFLOW_WORKSPACE", "visa-ramadhan").strip() or "visa-ramadhan"

    default_model_dir = os.path.join(repo_root, "server", "uploads", "models")
    model_dir = _env("ROBOFLOW_MODEL_DIR", default_model_dir).strip() or default_model_dir
    filename = _env("ROBOFLOW_FILENAME", "1750759502008-last.pt").strip() or "1750759502008-last.pt"
    model_name = _env("ROBOFLOW_MODEL_NAME", "focus").strip() or "focus"

    model_type = _env("ROBOFLOW_MODEL_TYPE", "").strip() or _read_artifacts_model_type(model_dir) or "yolo26n"

    if not os.path.isdir(model_dir):
        raise SystemExit(f"Folder model tidak ditemukan: {model_dir}")

    weights_path = os.path.join(model_dir, filename)
    if not os.path.exists(weights_path):
        raise SystemExit(f"File weights tidak ditemukan: {weights_path}")

    rf = Roboflow(api_key=api_key)
    workspace = rf.workspace(workspace_name)
    available = workspace.projects() or []
    available_slugs = [str(p).split("/")[-1].strip() for p in available if str(p).split("/")[-1].strip()]

    model_id = _env("ROBOFLOW_MODEL_ID", "").strip()
    project_from_model_id = model_id.split("/", 1)[0].strip() if "/" in model_id else model_id
    project_ids_raw = _env("ROBOFLOW_PROJECT_IDS", "").strip() or project_from_model_id

    raw_items = [p.strip() for p in (project_ids_raw or "").split(",") if p.strip()]
    project_ids = [item.split("/")[-1].strip() for item in raw_items if item.split("/")[-1].strip()]
    if not project_ids:
        if project_from_model_id and project_from_model_id in available_slugs:
            project_ids = [project_from_model_id]
        elif len(available_slugs) == 1:
            project_ids = [available_slugs[0]]
        else:
            raise SystemExit(f"ROBOFLOW_PROJECT_IDS kosong/invalid. Projects yang tersedia: {available}")

    if any(pid not in available_slugs for pid in project_ids):
        if len(available_slugs) == 1:
            project_ids = [available_slugs[0]]
        elif project_from_model_id in available_slugs:
            project_ids = [project_from_model_id]
        else:
            raise SystemExit(f"Project tidak bisa diakses. Input: {project_ids}. Tersedia: {available}")

    print(f"Workspace: {workspace_name}")
    print(f"Project IDs: {project_ids}")
    print(f"Model type: {model_type}")
    print(f"Filename: {filename}")

    result = workspace.deploy_model(
        model_type=model_type,
        model_path=model_dir,
        project_ids=project_ids,
        model_name=model_name,
        filename=filename,
    )
    print(result)


if __name__ == "__main__":
    main()
