import os
from pathlib import Path
import shutil
import sys

from .branding import load_unit_tray_icon


SUITE_DIR = Path(os.getenv("LOCALAPPDATA", Path.home())) / "Fioreze" / "Suite"
INSTALLED_EXE = SUITE_DIR / "Fioreze-Suite.exe"
UNIT_ICON = SUITE_DIR / "unidade.ico"


def erp_url(origin, hotel_slug):
    return f"{origin.rstrip('/')}/{str(hotel_slug).strip('/')}/admin/erp/"


def install_suite(
    *,
    origin,
    hotel_slug,
    hotel_name,
    icon_url=None,
    create_erp_shortcuts=True,
    enable_print_agent=False,
    executable=None,
    desktop_dir=None,
    start_menu_dir=None,
):
    SUITE_DIR.mkdir(parents=True, exist_ok=True)
    source = Path(executable or sys.executable)
    installed_exe = INSTALLED_EXE
    if getattr(sys, "frozen", False) and source.exists() and source.resolve() != installed_exe.resolve():
        shutil.copy2(source, installed_exe)
    image = load_unit_tray_icon(origin, icon_url)
    image.save(UNIT_ICON, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (128, 128)])
    url = erp_url(origin, hotel_slug)
    shortcut_name = f"ERP {safe_filename(hotel_name)}.url"
    written = []
    folders = [desktop_dir or windows_desktop(), start_menu_dir or windows_start_menu()] if create_erp_shortcuts else []
    for folder in folders:
        if not folder:
            continue
        path = Path(folder) / shortcut_name
        path.parent.mkdir(parents=True, exist_ok=True)
        write_url_shortcut(path, url, UNIT_ICON)
        written.append(path)
    if enable_print_agent and installed_exe.exists() and os.name == "nt":
        register_startup(installed_exe)
    return {"erp_url": url, "shortcuts": written, "installed_exe": installed_exe if installed_exe.exists() else source}


def write_url_shortcut(path, url, icon_path):
    Path(path).write_text(
        "[InternetShortcut]\n"
        f"URL={url}\n"
        f"IconFile={icon_path}\n"
        "IconIndex=0\n",
        encoding="utf-8",
    )


def register_startup(executable):
    import winreg

    with winreg.OpenKey(
        winreg.HKEY_CURRENT_USER,
        r"Software\Microsoft\Windows\CurrentVersion\Run",
        0,
        winreg.KEY_SET_VALUE,
    ) as key:
        winreg.SetValueEx(key, "FiorezePrintAgent", 0, winreg.REG_SZ, f'"{executable}" --tray')


def windows_desktop():
    return Path(os.getenv("USERPROFILE", Path.home())) / "Desktop" if os.name == "nt" else None


def windows_start_menu():
    appdata = os.getenv("APPDATA")
    return Path(appdata) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Fioreze" if appdata else None


def safe_filename(value):
    return "".join(character for character in str(value) if character not in '<>:"/\\|?*').strip() or "Fioreze"
