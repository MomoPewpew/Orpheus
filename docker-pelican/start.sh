#!/bin/bash

echo "Activating virtual environment..."
source /opt/venv/bin/activate

cd /home/container

echo "Current directory contents:"
ls -la /home/container/audio_processing

echo "Static directory contents:"
ls -la /home/container/audio_processing/static || echo "Static directory not found"

echo "Data directory contents:"
ls -la /home/container/audio_processing/data || echo "Data directory not found"

echo "Frontend directory contents:"
ls -la /home/container/frontend || echo "Frontend directory not found"

echo "Python version and location:"
which python
python --version

echo "Installed packages:"
pip list

echo "Starting Flask application..."
cd /home/container/audio_processing
python app.py &

echo "Starting FastAPI application..."
cd /home/container/discord_bot
uvicorn main:app --host 0.0.0.0 --port 5001 &

# Wait for both processes
wait