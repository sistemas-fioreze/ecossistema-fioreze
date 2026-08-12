$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Venv = Join-Path $Root ".venv-build"
$Dist = Join-Path $Root "dist"
$Release = Join-Path $Root "release"
$Package = Join-Path $Release "Fioreze-Suite-Windows"
$Archive = Join-Path $Release "Fioreze-Suite-Windows.zip"
$DesktopRoot = Resolve-Path (Join-Path $Root "..\..\desktop\room-service")
$DesktopPackage = Join-Path $DesktopRoot "release\win-unpacked"
$VersionFile = Join-Path $Root "fioreze_print_agent\version.py"

if ($env:FIOREZE_PYTHON -and (Test-Path -LiteralPath $env:FIOREZE_PYTHON)) {
  $PythonCommand = $env:FIOREZE_PYTHON
  $PythonArguments = @()
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  $PythonCommand = (Get-Command python).Source
  $PythonArguments = @()
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
  $PythonCommand = "py"
  $PythonArguments = @()
} else {
  throw "Nenhum runtime Python compativel foi encontrado para o build."
}

if (Test-Path $Dist) { Remove-Item $Dist -Recurse -Force }
if (Test-Path $Release) { Remove-Item $Release -Recurse -Force }
if (Test-Path $Venv) { Remove-Item $Venv -Recurse -Force }

Push-Location $DesktopRoot
try {
  npm.cmd ci
  npm.cmd run test
  npm.cmd run dist:win
} finally {
  Pop-Location
}

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
Copy-Item $DesktopPackage (Join-Path $Package "Fioreze-ERP") -Recurse

@"
FIOREZE SUITE - ERP E IMPRESSAO DE PEDIDOS

1. Abra Fioreze-Suite.exe.
2. Escolha a unidade.
3. Escolha se deseja instalar o aplicativo ERP e o agente de impressao.
4. Para a impressao, informe o codigo de conexao gerado no ERP.
5. Selecione a impressora e o modelo do comprovante.

O pacote inclui o ERP desktop, o Python e as dependencias necessarias. O ERP
carrega a versao web oficial da unidade e recebe as atualizacoes publicadas sem
precisar ser reinstalado. A configuracao e o
token protegido sao criados somente no computador depois da ativacao e nao fazem
parte deste pacote.
"@ | Set-Content -Path (Join-Path $Package "LEIA-ME.txt") -Encoding UTF8

$Commit = (git -C $Root rev-parse --short=12 HEAD 2>$null)
if (-not $Commit) { $Commit = "build-local" }
$VersionMatch = Select-String -Path $VersionFile -Pattern 'APP_VERSION\s*=\s*"([^"]+)"'
$Version = if ($VersionMatch) { $VersionMatch.Matches[0].Groups[1].Value } else { "build-local" }
"Versao $Version`nCommit $Commit" | Set-Content -Path (Join-Path $Package "VERSAO.txt") -Encoding UTF8
$SuiteHash = (Get-FileHash (Join-Path $Package "Fioreze-Suite.exe") -Algorithm SHA256).Hash.ToLowerInvariant()
$ErpHash = (Get-FileHash (Join-Path $Package "Fioreze-ERP\Fioreze ERP.exe") -Algorithm SHA256).Hash.ToLowerInvariant()
"$SuiteHash  Fioreze-Suite.exe`n$ErpHash  Fioreze-ERP\Fioreze ERP.exe" | Set-Content -Path (Join-Path $Package "SHA256SUMS.txt") -Encoding ASCII
Compress-Archive -Path $Package -DestinationPath $Archive -CompressionLevel Optimal -Force

Write-Host "Pacote criado em $Package"
Write-Host "Arquivo ZIP criado em $Archive"
