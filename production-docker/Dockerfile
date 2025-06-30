# Multi-stage build file for Orpheus production deployment
# Frontend: React/TypeScript
# Backend: Python/Flask

FROM alpine:latest AS downloader
WORKDIR /download
RUN apk add --no-cache curl unzip
RUN curl -L https://github.com/MomoPewpew/Orpheus/releases/download/v1.1/Orpheus.v1.1.zip -o orpheus.zip
RUN unzip orpheus.zip -d /app
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
    && rm -rf /var/lib/apt/lists/*

# Create and activate virtual environment
ENV VIRTUAL_ENV=/opt/venv
RUN python -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN ln -sf /dev/stdout /var/log/nginx/access.log \
    && ln -sf /dev/stderr /var/log/nginx/error.log

# Copy app files and install Python dependencies
COPY --from=downloader /app /app
WORKDIR /app/audio_processing

# Copy frontend files to Flask static directory
RUN mkdir -p static && \
    cp -r /app/frontend/* static/

# Install Python packages with verbose output
RUN pip install --verbose -r requirements.txt
WORKDIR /app/discord_bot
RUN pip install --verbose -r requirements.txt
WORKDIR /app/audio_processing

# Copy startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Set environment variables for better debugging
ENV PYTHONUNBUFFERED=1
ENV PYTHONFAULTHANDLER=1
ENV PYTHONTRACEMALLOC=1

EXPOSE 80 5000

CMD ["/start.sh"] 