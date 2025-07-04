#!/bin/bash
cd /mnt/server

echo "Installing Orpheus..."

# Download and extract Orpheus
echo "Downloading Orpheus..."
curl -L https://github.com/MomoPewpew/Orpheus/releases/download/v1.2.1/Orpheus.v1.2.1-pelican.zip -o orpheus.zip
unzip orpheus.zip
rm orpheus.zip

# Fix paths in start.sh
echo "Fixing paths in start.sh..."
sed -i 's|/app|/home/container|g' /mnt/server/start.sh
# Add PYTHONPATH to start.sh after virtual environment activation
sed -i '/source \/opt\/venv\/bin\/activate/a export PYTHONPATH=/home/container:$PYTHONPATH' /mnt/server/start.sh
dos2unix /mnt/server/start.sh
chmod +x /mnt/server/start.sh

# Ensure proper permissions
echo "Setting permissions..."
chmod -R 755 /mnt/server

# Create necessary directories
echo "Creating data directory..."
mkdir -p /mnt/server/audio_processing/data
chmod -R 777 /mnt/server/audio_processing/data

# Verify critical files
if [ ! -f /mnt/server/start.sh ]; then
    echo "ERROR: Critical file start.sh not found!"
    exit 1
fi

echo "Installation complete! You can now start the server."
exit 0 