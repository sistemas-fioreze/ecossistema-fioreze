import json
import os
from pathlib import Path
from datetime import datetime, timezone

from .config import APP_DIR
from .version import APP_VERSION


STATUS_FILE = APP_DIR / "runtime-status.json"
RESTART_REQUEST_FILE = APP_DIR / "restart.request"
SHOW_REQUEST_FILE = APP_DIR / "show.request"


def write_runtime_status(status, message, config=None, path=STATUS_FILE):
    config = config or {}
    payload = {
        "status": status if status in {"starting", "running", "restarting", "stopped", "not_configured"} else "running",
        "message": _clean_text(message, 180),
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "pid": os.getpid(),
        "hotel_id": _clean_identifier(config.get("hotel_id")),
        "device_id": _clean_identifier(config.get("device_id")),
        "device_name": _clean_text(config.get("device_name"), 120),
        "printer_name": _clean_text(config.get("printer_name"), 160),
        "app_version": APP_VERSION,
    }
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    temporary.replace(target)
    return payload


def consume_restart_request(path=RESTART_REQUEST_FILE):
    target = Path(path)
    if not target.exists():
        return False
    try:
        target.unlink()
    except FileNotFoundError:
        return False
    return True


def consume_show_request(path=SHOW_REQUEST_FILE):
    target = Path(path)
    if not target.exists():
        return False
    try:
        target.unlink()
    except FileNotFoundError:
        return False
    return True


def _clean_identifier(value):
    value = str(value or "").strip()
    return value if value and len(value) <= 128 and all(character.isalnum() or character in "_-" for character in value) else ""


def _clean_text(value, maximum):
    return "".join(" " if ord(character) < 32 or ord(character) == 127 else character for character in str(value or "")).strip()[:maximum]
