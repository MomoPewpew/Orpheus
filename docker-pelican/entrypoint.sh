#!/bin/bash
cd /home/container

# Output Python version
python --version

# Debug: List contents of various directories
echo "Contents of /home/container:"
ls -la /home/container
echo -e "\nContents of /:"
ls -la /
echo -e "\nCurrent working directory: $(pwd)"
ls -la

# Make start.sh executable and fix line endings
if [ -f "/home/container/start.sh" ]; then
    dos2unix /home/container/start.sh
    chmod +x /home/container/start.sh
fi

# Replace Startup Variables
MODIFIED_STARTUP=`eval echo $(echo ${STARTUP} | sed -e 's/{{/${/g' -e 's/}}/}/g')`
echo ":/home/container$ ${MODIFIED_STARTUP}"

# Run the Server
${MODIFIED_STARTUP} 