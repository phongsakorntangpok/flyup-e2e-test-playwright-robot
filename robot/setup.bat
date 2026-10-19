@echo off
rem Install Robot Framework + Browser library into robot\.venv (run once)
cd /d "%~dp0"

rem Use "python" if it really runs (not the Microsoft Store shortcut), otherwise the "py" launcher
set PY=
python --version >nul 2>nul && set PY=python
if not defined PY py -3 --version >nul 2>nul && set PY=py -3
rem Python installed by winget / python.org for the current user but not on PATH
if not defined PY for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*") do if exist "%%~D\python.exe" set PY="%%~D\python.exe"
if not defined PY for /d %%D in ("%ProgramFiles%\Python3*") do if exist "%%~D\python.exe" set PY="%%~D\python.exe"
if not defined PY (
  echo [ERROR] Python not found. Install Python 3.10+ from https://www.python.org/downloads/
  echo         tick "Add python.exe to PATH" in the installer, then open a NEW cmd window.
  exit /b 1
)
%PY% --version

if not exist .venv\Scripts\python.exe (
  echo Creating virtual environment .venv ...
  %PY% -m venv .venv || exit /b 1
)

.venv\Scripts\python.exe -m pip install --upgrade pip || exit /b 1
.venv\Scripts\python.exe -m pip install -r requirements.txt || exit /b 1

echo Installing Browser library dependencies + Chromium (needs Node.js) ...
.venv\Scripts\rfbrowser.exe init chromium || exit /b 1

echo.
echo Setup complete. Run tests with:  run.bat
echo One test case:                   run.bat --include TC-14-001
