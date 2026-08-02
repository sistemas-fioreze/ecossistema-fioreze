import base64
import ctypes
import ctypes.wintypes
import json
import os
from pathlib import Path


APP_DIR = Path(os.getenv("LOCALAPPDATA", Path.home())) / "Fioreze" / "PrintAgent"
CONFIG_FILE = APP_DIR / "config.json"


class DATA_BLOB(ctypes.Structure):
    _fields_ = [("cbData", ctypes.wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]


def load_config(path=CONFIG_FILE):
    path = Path(path)
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    protected = data.pop("protected_token", None)
    if protected:
        data["token"] = unprotect_secret(protected)
    return data


def save_config(config, path=CONFIG_FILE):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    public = {key: value for key, value in config.items() if key != "token"}
    public["protected_token"] = protect_secret(config["token"])
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(public, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def protect_secret(value):
    if os.name != "nt":
        raise RuntimeError("A protecao DPAPI requer Windows.")
    raw = value.encode("utf-8")
    source, source_buffer = _blob(raw)
    destination = DATA_BLOB()
    if not ctypes.windll.crypt32.CryptProtectData(ctypes.byref(source), "Fioreze Print Agent", None, None, None, 0, ctypes.byref(destination)):
        raise ctypes.WinError()
    try:
        return base64.b64encode(ctypes.string_at(destination.pbData, destination.cbData)).decode("ascii")
    finally:
        ctypes.windll.kernel32.LocalFree(destination.pbData)


def unprotect_secret(value):
    if os.name != "nt":
        raise RuntimeError("A protecao DPAPI requer Windows.")
    source, source_buffer = _blob(base64.b64decode(value))
    destination = DATA_BLOB()
    if not ctypes.windll.crypt32.CryptUnprotectData(ctypes.byref(source), None, None, None, None, 0, ctypes.byref(destination)):
        raise ctypes.WinError()
    try:
        return ctypes.string_at(destination.pbData, destination.cbData).decode("utf-8")
    finally:
        ctypes.windll.kernel32.LocalFree(destination.pbData)


def _blob(value):
    buffer = ctypes.create_string_buffer(value)
    blob = DATA_BLOB(len(value), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_char)))
    return blob, buffer
