@echo off
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  start "" py -3w "%~dp0server.pyw"
  exit /b
)

where pythonw >nul 2>nul
if %errorlevel%==0 (
  start "" pythonw "%~dp0server.pyw"
  exit /b
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "" python "%~dp0server.pyw"
  exit /b
)

echo Python nao encontrado. Instale o Python 3 e execute este arquivo novamente.
pause
