$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Venv = Join-Path $Root ".venv-build"

py -3.12 -m venv $Venv
& "$Venv\Scripts\python.exe" -m pip install --upgrade pip
& "$Venv\Scripts\python.exe" -m pip install -r (Join-Path $Root "requirements-build.txt")
& "$Venv\Scripts\pyinstaller.exe" `
  --noconfirm `
  --clean `
  --onefile `
  --windowed `
  --name "Fioreze-Impressao" `
  --paths $Root `
  (Join-Path $Root "launcher.py")

Write-Host "Executavel criado em $Root\dist\Fioreze-Impressao.exe"
