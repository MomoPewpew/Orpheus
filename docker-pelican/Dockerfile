# Base Python image for Orpheus
FROM python:3.9-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    libffi-dev \
    procps \
    vim \
    ffmpeg \
    dos2unix \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -d /home/container -s /bin/bash container

# Create and activate virtual environment
ENV VIRTUAL_ENV=/opt/venv
RUN python -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Copy requirements files
COPY requirements/discord_bot/requirements.txt /requirements/discord_bot/requirements.txt
COPY requirements/audio_processing/requirements.txt /requirements/audio_processing/requirements.txt

# Install Python packages
RUN pip install -r /requirements/audio_processing/requirements.txt && \
    pip install -r /requirements/discord_bot/requirements.txt

# Set environment variables for better debugging
ENV PYTHONUNBUFFERED=1
ENV PYTHONFAULTHANDLER=1
ENV PYTHONTRACEMALLOC=1

# Copy and set up entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN dos2unix /entrypoint.sh && \
    chmod +x /entrypoint.sh && \
    chown container:container /entrypoint.sh

# Set working directory and ensure container user has access
WORKDIR /home/container
RUN chown container:container /home/container

# Set container user and environment
USER container
ENV USER=container HOME=/home/container

EXPOSE 5000 5001

CMD ["/bin/bash", "/entrypoint.sh"]