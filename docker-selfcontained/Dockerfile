# Multi-stage build file for Orpheus production deployment
# Frontend: React/TypeScript
# Backend: Python/Flask

FROM alpine:latest AS downloader
WORKDIR /download
RUN apk add --no-cache curl unzip
RUN curl -L https://github.com/MomoPewpew/Orpheus/releases/download/v1.2.1/Orpheus.v1.2.1.zip -o orpheus.zip
RUN unzip orpheus.zip -d /home/container
RUN rm orpheus.zip

# Final stage with Python and nginx
FROM python:3.9-slim

# Install nginx and other dependencies
RUN apt-get update && apt-get install -y \
    nginx \
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

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create container directory and copy app files
RUN mkdir -p /home/container
COPY --from=downloader /home/container/ /home/container/

# Copy and prepare start script
COPY ["./start.sh", "/home/container/start.sh"]
RUN dos2unix /home/container/start.sh && \
    chmod +x /home/container/start.sh && \
    ls -la /home/container/start.sh && \
    cat /home/container/start.sh

WORKDIR /home/container/audio_processing

# Copy frontend files to Flask static directory
RUN mkdir -p static && \
    cp -r /home/container/frontend/* static/

# Install Python packages with verbose output
RUN pip install --verbose -r requirements.txt
WORKDIR /home/container/discord_bot
RUN pip install --verbose -r requirements.txt
WORKDIR /home/container/audio_processing

# Set environment variables for better debugging
ENV PYTHONUNBUFFERED=1
ENV PYTHONFAULTHANDLER=1
ENV PYTHONTRACEMALLOC=1

# Create data directory with proper permissions
RUN mkdir -p /home/container/audio_processing/data && \
    chmod -R 777 /home/container/audio_processing/data

EXPOSE 80 5000

CMD ["/home/container/start.sh"] 