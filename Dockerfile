# Use Node.js as base image since we need it for the frontend
FROM node:18-slim

# Install Python and other dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-venv \
    python3-pip \
    procps \
    psmisc \
    libopus0 \
    libopus-dev \
    ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Create necessary directories
RUN mkdir -p /app/audio-processing/static \
    /app/audio-processing/data/audio \
    /app/discord-bot \
    /app/frontend && \
    chmod -R 777 /app/audio-processing/data  # Ensure directory is writable

# Create and activate virtual environment
RUN python3.11 -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"

# Copy backend requirements first
COPY audio-processing/requirements.txt /app/audio-processing/
COPY discord-bot/requirements.txt /app/discord-bot/

# Install Python dependencies in virtual environment
RUN . /app/venv/bin/activate && \
    pip install --no-cache-dir -r /app/audio-processing/requirements.txt && \
    pip install --no-cache-dir -r /app/discord-bot/requirements.txt

# Set up frontend
WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Increase memory limit for Node.js
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Install dependencies in a separate layer
RUN npm install --legacy-peer-deps && \
    npm install --save-dev @types/lodash && \
    npm install --save lodash && \
    npm install --save jszip@3.10.1 && \
    npm install --save-dev @types/jszip@3.4.1

# Copy frontend source code
COPY frontend/ ./

# Build the frontend in development mode
RUN npm run build

# Copy application code
WORKDIR /app
COPY audio-processing/ /app/audio-processing/
COPY discord-bot/ /app/discord-bot/

# Create startup script
RUN echo '#!/bin/bash\n\
source /app/venv/bin/activate\n\
echo "Checking data directory permissions..."\n\
ls -la /app/audio-processing/data\n\
echo "Current working directory: $(pwd)"\n\
echo "Starting Discord bot..."\n\
cd /app/discord-bot && PYTHONPATH=/app/discord-bot python -m src.bot.__main__ > discord.log 2>&1 & \n\
echo "Starting frontend development server..."\n\
cd /app/frontend && NODE_OPTIONS="--max-old-space-size=4096" npm start & \n\
echo "Starting Flask server in development mode..."\n\
cd /app/audio-processing && FLASK_ENV=development FLASK_DEBUG=1 python -m flask run --host=0.0.0.0 --port=5000\n' > /app/start.sh && \
    chmod +x /app/start.sh

# Expose ports
EXPOSE 5000 3000

# Run all services
CMD ["/app/start.sh"] 