#!/bin/bash
echo "Starting BugLord AI Backend Server..."
echo ""
echo "The server will be available at http://0.0.0.0:8000"
echo "Press Ctrl+C to stop."
echo ""

cd "$(dirname "$0")"

# Activate venv if it exists
if [ -f "../.venv/bin/activate" ]; then
    source "../.venv/bin/activate"
fi

python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
