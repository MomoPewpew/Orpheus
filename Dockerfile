# Use Node.js as base image since we need it for the frontend build
FROM node:18-slim AS frontend-builder

# Set working directory for frontend
WORKDIR /frontend-build

# Copy package files first to leverage cache
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm install

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build

# Start fresh with Python image for the final stage
FROM python:3.11-slim AS final

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    procps \
    psmisc && \
    rm -rf /var/lib/apt/lists/*

# Create necessary directories
RUN mkdir -p /app/audio-processing/static \
    /app/audio-processing/data/audio \
    /app/discord-bot

# Copy backend code first
COPY audio-processing/requirements.txt /app/audio-processing/
COPY discord-bot/requirements.txt /app/discord-bot/

# Install Python dependencies
RUN pip install --no-cache-dir -r /app/audio-processing/requirements.txt && \
    pip install --no-cache-dir -r /app/discord-bot/requirements.txt

# Copy application code
COPY audio-processing/ /app/audio-processing/
COPY discord-bot/ /app/discord-bot/

# Copy frontend build from builder stage
COPY --from=frontend-builder /frontend-build/build/. /app/audio-processing/static/

# Create startup script with error handling and logging
RUN echo '#!/bin/bash\n\
echo "Starting Discord bot..."\n\
cd /app/discord-bot && PYTHONPATH=/app/discord-bot python -m src.bot.__main__ > discord.log 2>&1 & \n\
echo "Starting FastAPI server in development mode..."\n\
cd /app/audio-processing && exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload\n' > /app/start.sh && \
    chmod +x /app/start.sh

# Expose port
EXPOSE 8000

# Run both services
CMD ["/app/start.sh"] 