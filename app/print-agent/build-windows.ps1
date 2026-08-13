$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Venv = Join-Path ([System.IO.Path]::GetTempPath()) "fioreze-suite-build-$PID"
$Dist = Join-Path $Root "dist"
$Release = Join-Path $Root "release"
$Package = Join-Path $Release "Fioreze-Suite-Windows"
$Archive = Join-Path $Release "Fioreze-Suite-Windows.zip"
$UpdaterRelease = Join-Path $Release "Updater"
$PrintAgentUpdaterRelease = Join-Path $Release "Print-Agent-Updater"
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
  npm.cmd run dist:release
} finally {
  Pop-Location
}

& $PythonCommand @PythonArguments -m venv $Venv
& "$Venv\Scripts\python.exe" -m pip install --upgrade pip
& "$Venv\Scripts\python.exe" -m pip install -r (Join-Path $Root "requirements-build.txt")
Push-Location $Root
try {
  & "$Venv\Scripts\pyinstaller.exe" `
    --noconfirm `
    --clean `
    --onefile `
    --windowed `
    --name "Fioreze-Suite" `
    --paths $Root `
    (Join-Path $Root "launcher.py")
} finally {
  Pop-Location
}

New-Item -ItemType Directory -Force -Path $Package | Out-Null
Copy-Item (Join-Path $Dist "Fioreze-Suite.exe") (Join-Path $Package "Fioreze-Suite.exe")
$VersionMatch = Select-String -Path $VersionFile -Pattern 'APP_VERSION\s*=\s*"([^"]+)"'
$Version = if ($VersionMatch) { $VersionMatch.Matches[0].Groups[1].Value } else { "build-local" }
$AgentReleaseName = "Fioreze-Suite-$Version.exe"
$AgentReleaseExecutable = Join-Path $PrintAgentUpdaterRelease $AgentReleaseName
New-Item -ItemType Directory -Force -Path $PrintAgentUpdaterRelease | Out-Null
Copy-Item (Join-Path $Dist "Fioreze-Suite.exe") $AgentReleaseExecutable
$AgentReleaseHash = (Get-FileHash $AgentReleaseExecutable -Algorithm SHA256).Hash.ToLowerInvariant()
$AgentReleaseSize = (Get-Item -LiteralPath $AgentReleaseExecutable).Length
$AgentManifest = [ordered]@{
  schema_version = 1
  version = $Version
  file = $AgentReleaseName
  sha256 = $AgentReleaseHash
  size_bytes = $AgentReleaseSize
  release_notes = "Atualizacao segura do Fioreze Suite, ERP e agente de impressao."
} | ConvertTo-Json
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $PrintAgentUpdaterRelease "latest.json"), $AgentManifest, $Utf8NoBom)
$NativeInstaller = Get-ChildItem -LiteralPath (Join-Path $DesktopRoot "release") -Filter "Fioreze-ERP-Setup-*.exe" -File | Sort-Object Name -Descending | Select-Object -First 1
$NativeBlockmap = Get-ChildItem -LiteralPath (Join-Path $DesktopRoot "release") -Filter "Fioreze-ERP-Setup-*.exe.blockmap" -File | Sort-Object Name -Descending | Select-Object -First 1
$NativeManifest = Join-Path $DesktopRoot "release\latest.yml"
if (-not $NativeInstaller -or -not $NativeBlockmap -or -not (Test-Path -LiteralPath $NativeManifest)) {
  throw "Os artefatos de atualizacao nativa do ERP nao foram gerados."
}
New-Item -ItemType Directory -Force -Path (Join-Path $Package "Fioreze-ERP-Installer") | Out-Null
New-Item -ItemType Directory -Force -Path $UpdaterRelease | Out-Null
Copy-Item $NativeInstaller.FullName (Join-Path $Package "Fioreze-ERP-Installer\$($NativeInstaller.Name)")
Copy-Item $NativeInstaller.FullName (Join-Path $UpdaterRelease $NativeInstaller.Name)
Copy-Item $NativeBlockmap.FullName (Join-Path $UpdaterRelease $NativeBlockmap.Name)
Copy-Item $NativeManifest (Join-Path $UpdaterRelease "latest.yml")

@"
FIOREZE SUITE - ERP E IMPRESSAO DE PEDIDOS

1. Abra Fioreze-Suite.exe.
2. Escolha a unidade.
3. Escolha se deseja instalar o aplicativo ERP e o agente de impressao.
4. Para a impressao, informe o codigo de conexao gerado no ERP.
5. Selecione a impressora e o modelo do comprovante.

O pacote inclui o instalador nativo do ERP, o Python e as dependencias necessarias.
O ERP carrega a versao web oficial da unidade e recebe as atualizacoes publicadas
sem precisar ser reinstalado. Quando houver uma atualizacao nativa, o aplicativo
pedira confirmacao antes de baixar e instalar. O agente de impressao tambem
consulta seu proprio feed, valida tamanho e SHA-256 e so instala depois da
confirmacao do operador. A configuracao e o
token protegido sao criados somente no computador depois da ativacao e nao fazem
parte deste pacote.
"@ | Set-Content -Path (Join-Path $Package "LEIA-ME.txt") -Encoding UTF8

$Commit = (git -C $Root rev-parse --short=12 HEAD 2>$null)
if (-not $Commit) { $Commit = "build-local" }
"Versao $Version`nCommit $Commit" | Set-Content -Path (Join-Path $Package "VERSAO.txt") -Encoding UTF8
$SuiteHash = (Get-FileHash (Join-Path $Package "Fioreze-Suite.exe") -Algorithm SHA256).Hash.ToLowerInvariant()
$ErpHash = (Get-FileHash (Join-Path $Package "Fioreze-ERP-Installer\$($NativeInstaller.Name)") -Algorithm SHA256).Hash.ToLowerInvariant()
"$SuiteHash  Fioreze-Suite.exe`n$ErpHash  Fioreze-ERP-Installer\$($NativeInstaller.Name)" | Set-Content -Path (Join-Path $Package "SHA256SUMS.txt") -Encoding ASCII
Compress-Archive -Path $Package -DestinationPath $Archive -CompressionLevel Optimal -Force

Write-Host "Pacote criado em $Package"
Write-Host "Arquivo ZIP criado em $Archive"
Write-Host "Artefatos OTA do ERP criados em $UpdaterRelease"
Write-Host "Artefatos OTA da impressao criados em $PrintAgentUpdaterRelease"
if (Test-Path $Venv) { Remove-Item $Venv -Recurse -Force }
