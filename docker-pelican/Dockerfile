# Multi-stage build file for Orpheus production deployment
# Frontend: React/TypeScript
# Backend: Python/Flask

FROM alpine:latest AS downloader
WORKDIR /download
RUN apk add --no-cache curl unzip
RUN curl -L https://github.com/MomoPewpew/Orpheus/releases/download/v1.2.1/Orpheus.v1.2.1.zip -o orpheus.zip
RUN unzip orpheus.zip -d /app
RUN rm orpheus.zip

# Final stage
FROM python:3.9-slim

# Install other dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    libffi-dev \
    procps \
    vim \
    ffmpeg \
    dos2unix \
    && rm -rf /var/lib/apt/lists/*

# Create and activate virtual environment
ENV VIRTUAL_ENV=/opt/venv
RUN python -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Create container directory and copy app files
RUN mkdir -p /app
COPY --from=downloader /app/ /app/

# Copy and prepare start script
COPY ["./start.sh", "/app/start.sh"]
RUN dos2unix /app/start.sh && \
    chmod +x /app/start.sh && \
    ls -la /app/start.sh && \
    cat /app/start.sh

WORKDIR /app/audio_processing

# Copy frontend files to Flask static directory
RUN mkdir -p static && \
    cp -r /app/frontend/* static/

# Install Python packages with verbose output
RUN pip install --verbose -r requirements.txt
WORKDIR /app/discord_bot
RUN pip install --verbose -r requirements.txt
WORKDIR /app/audio_processing

# Set environment variables for better debugging
ENV PYTHONUNBUFFERED=1
ENV PYTHONFAULTHANDLER=1
ENV PYTHONTRACEMALLOC=1

# Create data directory with proper permissions
RUN mkdir -p /app/audio_processing/data && \
    chmod -R 777 /app/audio_processing/data

EXPOSE 5000

CMD ["/app/start.sh"] 