import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

from .branding import load_unit_tray_icon


SUITE_DIR = Path(os.getenv("LOCALAPPDATA", Path.home())) / "Fioreze" / "Suite"
INSTALLED_EXE = SUITE_DIR / "Fioreze-Suite.exe"
INSTALLED_ERP_DIR = Path(os.getenv("LOCALAPPDATA", Path.home())) / "Programs" / "Fioreze ERP"
INSTALLED_ERP_EXE = INSTALLED_ERP_DIR / "Fioreze ERP.exe"
ERP_CONFIG_FILE = SUITE_DIR / "erp-config.json"
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
    erp_executable=None,
    desktop_dir=None,
    start_menu_dir=None,
):
    SUITE_DIR.mkdir(parents=True, exist_ok=True)
    source = Path(executable or sys.executable)
    installed_exe = INSTALLED_EXE
    if getattr(sys, "frozen", False) and source.exists() and source.resolve() != installed_exe.resolve():
        shutil.copy2(source, installed_exe)
    erp_source = Path(erp_executable) if erp_executable else source.parent / "Fioreze-ERP" / "Fioreze ERP.exe"
    erp_installer = find_bundled_erp_installer(source.parent)
    installed_erp = INSTALLED_ERP_EXE
    if os.name == "nt" and not erp_executable and erp_installer:
        subprocess.run(
            [str(erp_installer), "/S"],
            check=True,
            timeout=240,
            shell=False,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    elif erp_source.exists() and erp_source.resolve() != installed_erp.resolve():
        if erp_executable:
            installed_erp.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(erp_source, installed_erp)
        else:
            shutil.copytree(erp_source.parent, INSTALLED_ERP_DIR, dirs_exist_ok=True)
    image = load_unit_tray_icon(origin, icon_url)
    image.save(UNIT_ICON, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (128, 128)])
    url = erp_url(origin, hotel_slug)
    if create_erp_shortcuts:
        write_erp_config(origin, hotel_slug, hotel_name, SUITE_DIR / "erp-config.json")
    shortcut_name = f"ERP {safe_filename(hotel_name)}"
    written = []
    folders = [desktop_dir or windows_desktop(), start_menu_dir or windows_start_menu()] if create_erp_shortcuts else []
    for folder in folders:
        if not folder:
            continue
        use_desktop_app = installed_erp.exists() and os.name == "nt"
        path = Path(folder) / f"{shortcut_name}{'.lnk' if use_desktop_app else '.url'}"
        path.parent.mkdir(parents=True, exist_ok=True)
        if use_desktop_app:
            write_windows_shortcut(path, installed_erp, UNIT_ICON)
        else:
            write_url_shortcut(path, url, UNIT_ICON)
        written.append(path)
    if enable_print_agent and installed_exe.exists() and os.name == "nt":
        register_startup(installed_exe)
    return {
        "erp_url": url,
        "shortcuts": written,
        "installed_exe": installed_exe if installed_exe.exists() else source,
        "installed_erp": installed_erp if installed_erp.exists() else None,
    }


def find_bundled_erp_installer(package_directory):
    directory = Path(package_directory) / "Fioreze-ERP-Installer"
    candidates = sorted(directory.glob("Fioreze-ERP-Setup-*.exe"), reverse=True)
    return candidates[0] if candidates else None


def write_erp_config(origin, hotel_slug, hotel_name, path=ERP_CONFIG_FILE):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "origin": str(origin).rstrip("/"),
        "hotel_slug": str(hotel_slug).strip("/"),
        "hotel_name": str(hotel_name).strip(),
    }
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(target)


def write_windows_shortcut(path, executable, icon_path):
    import win32com.client

    shell = win32com.client.Dispatch("WScript.Shell")
    shortcut = shell.CreateShortCut(str(path))
    shortcut.Targetpath = str(executable)
    shortcut.WorkingDirectory = str(Path(executable).parent)
    shortcut.IconLocation = f"{icon_path},0"
    shortcut.Description = "ERP Room Service Fioreze"
    shortcut.save()


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
