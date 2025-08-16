#!/bin/bash

echo "Activating virtual environment..."
source /opt/venv/bin/activate

cd /home/container

# Set Python path to include our modules
export PYTHONPATH=/home/container:$PYTHONPATH

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
python app.py > >(tee /home/container/flask.log) 2>&1 &
FLASK_PID=$!

echo "Starting FastAPI application..."
cd /home/container/audio_processing
uvicorn main:app --host 0.0.0.0 --port 5001 > >(tee /home/container/fastapi.log) 2>&1 &
FASTAPI_PID=$!

# Give processes a moment to start
sleep 2

# Check if processes started successfully
if ! kill -0 $FLASK_PID 2>/dev/null; then
    echo "Flask application failed to start"
    cat /home/container/flask.log
    exit 1
fi

if ! kill -0 $FASTAPI_PID 2>/dev/null; then
    echo "FastAPI application failed to start"
    cat /home/container/fastapi.log
    exit 1
fi

echo "All applications started successfully"

# Keep container running and show logs
echo "Tailing application logs..."
sleep infinity