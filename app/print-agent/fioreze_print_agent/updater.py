import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from .installer import INSTALLED_EXE, SUITE_DIR
from .version import APP_VERSION


UPDATE_BASE_URL = "https://portal.hoteisfioreze.com.br/downloads/print-agent"
UPDATE_MANIFEST_URL = f"{UPDATE_BASE_URL}/latest.json"
UPDATE_DIRECTORY = SUITE_DIR / "updates"
UPDATE_REMINDER_FILE = SUITE_DIR / "update-reminder.json"
MAX_MANIFEST_BYTES = 64 * 1024
MAX_UPDATE_BYTES = 150 * 1024 * 1024
DOWNLOAD_CHUNK_BYTES = 1024 * 1024
VERSION_PATTERN = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")


class UpdateError(RuntimeError):
    pass


def version_tuple(value):
    match = VERSION_PATTERN.fullmatch(str(value or ""))
    if not match:
        raise UpdateError("Versao de atualizacao invalida.")
    return tuple(int(part) for part in match.groups())


def milliseconds_until_next_local_midnight(now=None):
    current = now or datetime.now().astimezone()
    next_midnight = (current + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(1, int((next_midnight - current).total_seconds() * 1000))


def validate_manifest(payload):
    if not isinstance(payload, dict) or payload.get("schema_version") != 1:
        raise UpdateError("Manifesto de atualizacao invalido.")
    version = str(payload.get("version") or "")
    version_tuple(version)
    filename = str(payload.get("file") or "")
    if filename != f"Fioreze-Suite-{version}.exe":
        raise UpdateError("Arquivo de atualizacao invalido.")
    checksum = str(payload.get("sha256") or "").lower()
    if not SHA256_PATTERN.fullmatch(checksum):
        raise UpdateError("Checksum de atualizacao invalido.")
    size = payload.get("size_bytes")
    if not isinstance(size, int) or isinstance(size, bool) or size <= 0 or size > MAX_UPDATE_BYTES:
        raise UpdateError("Tamanho de atualizacao invalido.")
    notes = str(payload.get("release_notes") or "").strip()
    if len(notes) > 2000:
        raise UpdateError("Notas de atualizacao invalidas.")
    return {
        "schema_version": 1,
        "version": version,
        "file": filename,
        "sha256": checksum,
        "size_bytes": size,
        "release_notes": notes,
        "download_url": f"{UPDATE_BASE_URL}/{filename}",
    }


def check_for_update(current_version=APP_VERSION, opener=urlopen, timeout=8):
    request = Request(
        UPDATE_MANIFEST_URL,
        headers={
            "Accept": "application/json",
            "User-Agent": f"Fioreze-Suite/{current_version}",
        },
        method="GET",
    )
    try:
        with opener(request, timeout=timeout) as response:
            _validate_response_url(response, UPDATE_MANIFEST_URL)
            content = response.read(MAX_MANIFEST_BYTES + 1)
    except (OSError, TimeoutError, ValueError) as error:
        raise UpdateError("Nao foi possivel verificar atualizacoes.") from error
    if len(content) > MAX_MANIFEST_BYTES:
        raise UpdateError("Manifesto de atualizacao excede o limite permitido.")
    try:
        manifest = validate_manifest(json.loads(content.decode("utf-8-sig")))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise UpdateError("Manifesto de atualizacao invalido.") from error
    if version_tuple(manifest["version"]) <= version_tuple(current_version):
        return None
    return manifest


def download_update(manifest, directory=UPDATE_DIRECTORY, opener=urlopen, timeout=30, on_progress=None):
    manifest = validate_manifest(manifest)
    target_directory = Path(directory)
    target_directory.mkdir(parents=True, exist_ok=True)
    destination = target_directory / manifest["file"]
    partial = destination.with_suffix(".download")
    if destination.exists() and _verified_file(destination, manifest):
        if on_progress:
            on_progress(100)
        return destination
    partial.unlink(missing_ok=True)
    request = Request(
        manifest["download_url"],
        headers={
            "Accept": "application/vnd.microsoft.portable-executable",
            "User-Agent": f"Fioreze-Suite/{APP_VERSION}",
        },
        method="GET",
    )
    digest = hashlib.sha256()
    received = 0
    try:
        with opener(request, timeout=timeout) as response, partial.open("wb") as output:
            _validate_response_url(response, manifest["download_url"])
            header_length = response.headers.get("Content-Length") if getattr(response, "headers", None) else None
            if header_length and int(header_length) != manifest["size_bytes"]:
                raise UpdateError("Tamanho da atualizacao nao confere.")
            while True:
                chunk = response.read(DOWNLOAD_CHUNK_BYTES)
                if not chunk:
                    break
                received += len(chunk)
                if received > manifest["size_bytes"] or received > MAX_UPDATE_BYTES:
                    raise UpdateError("Atualizacao excede o tamanho permitido.")
                digest.update(chunk)
                output.write(chunk)
                if on_progress:
                    on_progress(min(99, int((received / manifest["size_bytes"]) * 100)))
            output.flush()
            os.fsync(output.fileno())
        if received != manifest["size_bytes"] or digest.hexdigest() != manifest["sha256"]:
            raise UpdateError("A verificacao de integridade da atualizacao falhou.")
        partial.replace(destination)
        if on_progress:
            on_progress(100)
        return destination
    except (OSError, TimeoutError, ValueError) as error:
        partial.unlink(missing_ok=True)
        if isinstance(error, UpdateError):
            raise
        raise UpdateError("Nao foi possivel baixar a atualizacao.") from error
    except UpdateError:
        partial.unlink(missing_ok=True)
        raise


def defer_update(version, path=UPDATE_REMINDER_FILE, now=None, hours=24):
    version_tuple(version)
    current = now or datetime.now(timezone.utc)
    payload = {
        "version": version,
        "remind_after": (current + timedelta(hours=hours)).isoformat().replace("+00:00", "Z"),
    }
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    temporary.replace(target)
    return payload


def is_update_deferred(version, path=UPDATE_REMINDER_FILE, now=None):
    target = Path(path)
    if not target.exists():
        return False
    try:
        payload = json.loads(target.read_text(encoding="utf-8"))
        if payload.get("version") != version:
            return False
        remind_after = datetime.fromisoformat(str(payload["remind_after"]).replace("Z", "+00:00"))
        return (now or datetime.now(timezone.utc)) < remind_after
    except (OSError, ValueError, KeyError, json.JSONDecodeError):
        return False


def can_self_update(executable=None, installed_executable=INSTALLED_EXE, frozen=None):
    current = Path(executable or sys.executable)
    installed = Path(installed_executable)
    is_frozen = getattr(sys, "frozen", False) if frozen is None else frozen
    try:
        return bool(is_frozen and current.exists() and installed.exists() and current.resolve() == installed.resolve())
    except OSError:
        return False


def schedule_update_install(downloaded_file, target=INSTALLED_EXE, script_path=None, popen=subprocess.Popen):
    source = Path(downloaded_file).resolve()
    destination = Path(target).resolve()
    if not source.is_file() or source.suffix.lower() != ".exe":
        raise UpdateError("Arquivo de atualizacao nao encontrado.")
    script = Path(script_path or (UPDATE_DIRECTORY / "apply-suite-update.ps1"))
    script.parent.mkdir(parents=True, exist_ok=True)
    script.write_text(_powershell_update_script(), encoding="utf-8")
    powershell = Path(os.getenv("SystemRoot", r"C:\Windows")) / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe"
    executable = str(powershell if powershell.exists() else (shutil.which("powershell.exe") or "powershell.exe"))
    command = [
        executable,
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(script),
        "-Source",
        str(source),
        "-Target",
        str(destination),
    ]
    kwargs = {
        "close_fds": True,
        "shell": False,
        "stdin": subprocess.DEVNULL,
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
    }
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
    try:
        popen(command, **kwargs)
    except OSError as error:
        raise UpdateError("Nao foi possivel iniciar a instalacao da atualizacao.") from error
    return command


def bootstrap_installed_suite(
    executable=None,
    installed_executable=INSTALLED_EXE,
    frozen=None,
    directory=UPDATE_DIRECTORY,
    scheduler=schedule_update_install,
):
    current = Path(executable or sys.executable)
    installed = Path(installed_executable)
    is_frozen = getattr(sys, "frozen", False) if frozen is None else frozen
    if not is_frozen:
        return False
    try:
        if current.resolve() == installed.resolve():
            return False
    except OSError as error:
        raise UpdateError("Nao foi possivel identificar a instalacao atual.") from error
    if not current.is_file():
        raise UpdateError("O instalador do Fioreze Suite nao foi encontrado.")
    update_directory = Path(directory)
    update_directory.mkdir(parents=True, exist_ok=True)
    staged = update_directory / f"Fioreze-Suite-{APP_VERSION}-bootstrap.exe"
    try:
        shutil.copy2(current, staged)
    except OSError as error:
        raise UpdateError("Nao foi possivel preparar a atualizacao local.") from error
    if current.stat().st_size != staged.stat().st_size or _file_sha256(current) != _file_sha256(staged):
        staged.unlink(missing_ok=True)
        raise UpdateError("A verificacao da atualizacao local falhou.")
    scheduler(staged, target=installed)
    return True


def _verified_file(path, manifest):
    target = Path(path)
    if not target.is_file() or target.stat().st_size != manifest["size_bytes"]:
        return False
    return _file_sha256(target) == manifest["sha256"]


def _file_sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        while chunk := stream.read(DOWNLOAD_CHUNK_BYTES):
            digest.update(chunk)
    return digest.hexdigest()


def _validate_response_url(response, expected_url):
    if not hasattr(response, "geturl"):
        return
    actual = urlsplit(str(response.geturl()))
    expected = urlsplit(expected_url)
    if actual.scheme != "https" or actual.hostname != expected.hostname or actual.path != expected.path:
        raise UpdateError("A atualizacao foi redirecionada para um endereco nao autorizado.")


def _powershell_update_script():
    return """param(
  [Parameter(Mandatory=$true)][string]$Source,
  [Parameter(Mandatory=$true)][string]$Target
)
$ErrorActionPreference = 'Stop'
$targetDirectory = Split-Path -Parent $Target
$updateDirectory = Split-Path -Parent $Source
$log = Join-Path $updateDirectory 'last-update.log'
$next = "$Target.next"
$backup = "$Target.previous"

function Write-UpdateLog([string]$Message) {
  "$(Get-Date -Format o) $Message" | Add-Content -LiteralPath $log -Encoding UTF8
}

try {
  New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null
  New-Item -ItemType Directory -Force -Path $updateDirectory | Out-Null
  Write-UpdateLog 'started'
  $installedProcesses = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $Target })
  foreach ($process in $installedProcesses) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }
  $stopDeadline = (Get-Date).AddSeconds(20)
  while (@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $Target }).Count -gt 0 -and (Get-Date) -lt $stopDeadline) {
    Start-Sleep -Milliseconds 250
  }
  if (@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $Target }).Count -gt 0) {
    throw 'O agente instalado nao encerrou dentro do limite seguro.'
  }
  Copy-Item -LiteralPath $Source -Destination $next -Force
  if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Force }
  if (Test-Path -LiteralPath $Target) { Move-Item -LiteralPath $Target -Destination $backup -Force }
  Move-Item -LiteralPath $next -Destination $Target -Force
  Start-Process -FilePath $Target -ArgumentList '--tray' -WindowStyle Hidden
  Remove-Item -LiteralPath $Source -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue
  Write-UpdateLog 'completed'
} catch {
  if (Test-Path -LiteralPath $backup) { Move-Item -LiteralPath $backup -Destination $Target -Force }
  Write-UpdateLog "failed $($_.Exception.GetType().Name)"
  exit 4
}
Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue
"""
