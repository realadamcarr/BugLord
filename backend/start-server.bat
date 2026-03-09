@echo off
echo Starting BugLord AI Backend Server...
echo.
echo The server will be available at http://0.0.0.0:8000
echo Press Ctrl+C to stop.
echo.

cd /d "%~dp0"
call "%~dp0..\.venv\Scripts\activate.bat"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
