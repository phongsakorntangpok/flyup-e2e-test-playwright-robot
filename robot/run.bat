@echo off
rem Run Robot tests:  run.bat                      (all)
rem                   run.bat --include TC-14-001  (one test case)
rem                   run.bat --include negative   (by tag)
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  echo [ERROR] Robot Framework is not installed yet. Run setup.bat first.
  exit /b 1
)
.venv\Scripts\python.exe -m robot --outputdir results %* tests
