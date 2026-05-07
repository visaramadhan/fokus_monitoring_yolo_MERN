import os
from roboflow import Roboflow


def _env(name: str, default: str = "") -> str:
    val = os.environ.get(name)
    return default if val is None else str(val)


def main():
    api_key = _env("ROBOFLOW_API_KEY")
    if not api_key:
        raise SystemExit("ROBOFLOW_API_KEY belum diset. Set env var dulu.")

    workspace_name = _env("ROBOFLOW_WORKSPACE", "visa-ramadhan")
    project_ids_raw = _env("ROBOFLOW_PROJECT_IDS", "fokusDetection")
    raw_items = [p.strip() for p in project_ids_raw.split(",") if p.strip()]
    project_ids = [item.split("/")[-1].strip() for item in raw_items if item.split("/")[-1].strip()]
    if not project_ids:
        raise SystemExit("ROBOFLOW_PROJECT_IDS kosong. Contoh: fokusDetection")

    model_type = _env("ROBOFLOW_MODEL_TYPE", "yolov11")
    model_path = _env(
        "ROBOFLOW_MODEL_DIR",
        r"C:\Users\Visa Ramadhan\Documents\kudetekfokus\project\server\uploads\models",
    )
    filename = _env("ROBOFLOW_FILENAME", "1750759524871-best.pt")
    model_name = _env("ROBOFLOW_MODEL_NAME", "focus")

    if not os.path.isdir(model_path):
        raise SystemExit(f"Folder model tidak ditemukan: {model_path}")

    weights_path = os.path.join(model_path, filename)
    if not os.path.exists(weights_path):
        raise SystemExit(f"File weights tidak ditemukan: {weights_path}")

    rf = Roboflow(api_key=api_key)
    workspace = rf.workspace(workspace_name)
    print(f"Workspace: {workspace_name}")
    print(f"Project IDs: {project_ids}")

    result = workspace.deploy_model(
        model_type=model_type,
        model_path=model_path,
        project_ids=project_ids,
        model_name=model_name,
        filename=filename,
    )
    print(result)


if __name__ == "__main__":
    main()
