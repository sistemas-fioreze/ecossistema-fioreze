$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Venv = Join-Path $Root ".venv-build"
$Dist = Join-Path $Root "dist"
$Release = Join-Path $Root "release"
$Package = Join-Path $Release "Fioreze-Suite-Windows"
$Archive = Join-Path $Release "Fioreze-Suite-Windows.zip"

if ($env:FIOREZE_PYTHON) {
  $PythonCommand = $env:FIOREZE_PYTHON
  $PythonArguments = @()
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
  $PythonCommand = "py"
  $PythonArguments = @("-3.12")
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  $PythonCommand = "python"
  $PythonArguments = @()
} else {
  throw "Python 3.12 nao encontrado para o processo de build."
}

if (Test-Path $Dist) { Remove-Item $Dist -Recurse -Force }
if (Test-Path $Release) { Remove-Item $Release -Recurse -Force }

& $PythonCommand @PythonArguments -m venv $Venv
& "$Venv\Scripts\python.exe" -m pip install --upgrade pip
& "$Venv\Scripts\python.exe" -m pip install -r (Join-Path $Root "requirements-build.txt")
& "$Venv\Scripts\pyinstaller.exe" `
  --noconfirm `
  --clean `
  --onefile `
  --windowed `
  --name "Fioreze-Suite" `
  --paths $Root `
  (Join-Path $Root "launcher.py")

New-Item -ItemType Directory -Force -Path $Package | Out-Null
Copy-Item (Join-Path $Dist "Fioreze-Suite.exe") (Join-Path $Package "Fioreze-Suite.exe")

@"
FIOREZE SUITE - ERP E IMPRESSAO DE PEDIDOS

1. Abra Fioreze-Suite.exe.
2. Escolha a unidade.
3. Escolha se deseja criar o atalho do ERP e instalar a impressao.
4. Para a impressao, informe o codigo de conexao gerado no ERP.
5. Selecione a impressora e o modelo do comprovante.

O aplicativo inclui o Python e as dependencias necessarias. A configuracao e o
token protegido sao criados somente no computador depois da ativacao e nao fazem
parte deste pacote.
"@ | Set-Content -Path (Join-Path $Package "LEIA-ME.txt") -Encoding UTF8

$Commit = (git -C $Root rev-parse --short=12 HEAD 2>$null)
if (-not $Commit) { $Commit = "build-local" }
"Versao 1.2.0`nCommit $Commit" | Set-Content -Path (Join-Path $Package "VERSAO.txt") -Encoding UTF8
$Hash = (Get-FileHash (Join-Path $Package "Fioreze-Suite.exe") -Algorithm SHA256).Hash.ToLowerInvariant()
"$Hash  Fioreze-Suite.exe" | Set-Content -Path (Join-Path $Package "SHA256SUMS.txt") -Encoding ASCII
Compress-Archive -Path $Package -DestinationPath $Archive -CompressionLevel Optimal

Write-Host "Pacote criado em $Package"
Write-Host "Arquivo ZIP criado em $Archive"
