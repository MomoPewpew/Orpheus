#!/bin/sh

# Start nginx with error checking
echo "Starting nginx..."
nginx -g 'daemon off; error_log /tmp/nginx/error.log warn;' &
NGINX_PID=$!

# Check if nginx started successfully
sleep 1
if ! kill -0 $NGINX_PID 2>/dev/null; then
    echo "Nginx failed to start. Check error logs:"
    cat /tmp/nginx/error.log
    exit 1
fi

echo "Nginx started successfully (PID: $NGINX_PID)"
echo "Checking nginx error log..."
tail -f /tmp/nginx/error.log &

echo "Activating virtual environment..."
export PATH="/opt/venv/bin:$PATH"

# Set Python path to include audio_processing module
cd /app
export PYTHONPATH=/app:$PYTHONPATH

echo "Current directory contents:"
ls -la /app/audio_processing

echo "Static directory contents:"
ls -la /app/audio_processing/static/ 2>/dev/null || echo "Static directory not found"

echo "Data directory contents:"
ls -la /app/audio_processing/data/ 2>/dev/null || echo "Data directory not found"

echo "Frontend directory contents:"
ls -la /app/frontend/ 2>/dev/null || echo "Frontend directory not found"

echo "Python version and location:"
which python
python --version

echo "Installed packages:"
pip list

cd /app/audio_processing

# Start Flask app in background
echo "Starting Flask application..."
PYTHONPATH=/app python app.py --host 0.0.0.0 --port 5000 &
FLASK_PID=$!

# Start FastAPI app in background
echo "Starting FastAPI application..."
uvicorn main:app --host 0.0.0.0 --port 5001 &
FASTAPI_PID=$!

# Wait for all background processes
wait $FLASK_PID $FASTAPI_PID $NGINX_PID

# Exit with status of process that exited first
exit $? 