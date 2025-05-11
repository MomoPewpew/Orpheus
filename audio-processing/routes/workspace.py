from flask import Blueprint, request, jsonify
import json
import os
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

workspace_bp = Blueprint('workspace', __name__)

# Define paths
DATA_DIR = Path(__file__).parent.parent / 'data'
CONFIG_FILE = DATA_DIR / 'config.json'

def load_workspace() -> dict:
    """Load the workspace configuration."""
    try:
        if not CONFIG_FILE.exists():
            logger.debug("Config file not found, creating default")
            return {
                "files": [],
                "environments": [],
                "playState": "STOPPED"
            }
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
            logger.debug(f"Loaded config: {config}")
            return {
                "environments": config.get("environments", []),
                "playState": config.get("playState", "STOPPED")
            }
    except Exception as e:
        logger.error(f"Error loading config: {e}")
        return {
            "environments": [],
            "playState": "STOPPED"
        }

def save_workspace(workspace: dict):
    """Save the workspace configuration."""
    try:
        logger.debug(f"Saving workspace state: {workspace}")
        # Load existing config to preserve files data
        current_config = {}
        if CONFIG_FILE.exists():
            with open(CONFIG_FILE, 'r') as f:
                current_config = json.load(f)
        
        # Update with new workspace state while preserving files
        current_config["environments"] = workspace.get("environments", [])
        current_config["playState"] = workspace.get("playState", "STOPPED")
        
        # Ensure files array exists
        if "files" not in current_config:
            current_config["files"] = []
            
        with open(CONFIG_FILE, 'w') as f:
            json.dump(current_config, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving config: {e}")
        raise

def ensure_workspace_dir():
    """Create necessary directories and files if they don't exist."""
    logger.debug(f"Ensuring workspace directory exists: {DATA_DIR}")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    if not CONFIG_FILE.exists():
        logger.debug(f"Creating default config file at {CONFIG_FILE}")
        save_workspace({
            "environments": [],
            "playState": "STOPPED"
        })

# Call this when the blueprint is created
ensure_workspace_dir()

@workspace_bp.route('/workspace', methods=['GET'])
def get_workspace():
    """Get the current workspace state."""
    try:
        ensure_workspace_dir()
        workspace = load_workspace()
        return jsonify(workspace)
    except Exception as e:
        logger.error(f"Error getting workspace: {e}")
        return jsonify({"error": str(e)}), 500

@workspace_bp.route('/workspace', methods=['POST'])
def update_workspace():
    """Update the workspace state."""
    try:
        ensure_workspace_dir()
        workspace = request.get_json()
        logger.debug(f"Updating workspace with: {workspace}")
        save_workspace(workspace)
        return jsonify(workspace)
    except Exception as e:
        logger.error(f"Error updating workspace: {e}")
        return jsonify({"error": str(e)}), 500 