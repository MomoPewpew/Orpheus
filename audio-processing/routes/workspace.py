from flask import Blueprint, request, jsonify
import json
import os
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

workspace_bp = Blueprint('workspace', __name__)
DATA_DIR = Path(__file__).parent.parent / 'data'
CONFIG_FILE = DATA_DIR / 'config.json'

logger.info(f"Data directory path: {DATA_DIR}")
logger.info(f"Config file path: {CONFIG_FILE}")

@workspace_bp.route('/workspace', methods=['GET'])
def get_workspace():
    """Load the workspace configuration from file"""
    try:
        logger.debug(f"Attempting to load config from {CONFIG_FILE}")
        logger.debug(f"Config file exists: {CONFIG_FILE.exists()}")
        logger.debug(f"Data directory exists: {DATA_DIR.exists()}")
        
        if not CONFIG_FILE.exists():
            logger.info(f"Config file not found at {CONFIG_FILE}, creating default config")
            default_config = {
                'environments': [],
                'files': [],
                'masterVolume': 1,
                'playState': 'STOPPED'
            }
            # Ensure the directory exists
            DATA_DIR.mkdir(exist_ok=True)
            with open(CONFIG_FILE, 'w') as f:
                json.dump(default_config, f, indent=2)
            logger.info("Created default config file")
            return jsonify(default_config)
        
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
            logger.debug(f"Loaded config: {config}")
            return jsonify(config)
    except Exception as e:
        logger.error(f"Error loading config: {str(e)}")
        logger.exception("Full traceback:")
        return jsonify({'error': str(e)}), 500

@workspace_bp.route('/workspace', methods=['POST'])
def save_workspace():
    """Save the workspace configuration to file"""
    try:
        # Log the absolute paths
        logger.info(f"Data directory absolute path: {DATA_DIR.absolute()}")
        logger.info(f"Config file absolute path: {CONFIG_FILE.absolute()}")
        
        # Check directory permissions
        logger.info(f"Data directory exists: {DATA_DIR.exists()}")
        if DATA_DIR.exists():
            logger.info(f"Data directory is writable: {os.access(DATA_DIR, os.W_OK)}")
        
        # Ensure data directory exists
        DATA_DIR.mkdir(exist_ok=True)
        
        # Get the workspace data from request
        workspace = request.get_json()
        logger.debug(f"Received workspace data: {workspace}")
        
        # Save to file with pretty printing
        logger.info("Attempting to write config file...")
        with open(CONFIG_FILE, 'w') as f:
            json.dump(workspace, f, indent=2)
        
        # Verify the file was written
        logger.info(f"Config file exists after write: {CONFIG_FILE.exists()}")
        if CONFIG_FILE.exists():
            logger.info(f"Config file size: {CONFIG_FILE.stat().st_size} bytes")
            # Read back the file to verify content
            with open(CONFIG_FILE, 'r') as f:
                saved_content = f.read()
                logger.debug(f"Saved content: {saved_content}")
        
        logger.info(f"Successfully saved config to {CONFIG_FILE}")
        return jsonify({'message': 'Workspace saved successfully'})
    except Exception as e:
        logger.error(f"Error saving config: {str(e)}")
        logger.exception("Full traceback:")
        return jsonify({'error': str(e)}), 500 