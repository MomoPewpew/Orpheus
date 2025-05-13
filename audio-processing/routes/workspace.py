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
                "playState": "STOPPED",
                "masterVolume": 1,
                "soundboard": []
            }
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
            logger.debug(f"Loaded config: {config}")
            return {
                "environments": config.get("environments", []),
                "playState": config.get("playState", "STOPPED"),
                "masterVolume": config.get("masterVolume", 1),
                "soundboard": config.get("soundboard", [])
            }
    except Exception as e:
        logger.error(f"Error loading config: {e}")
        return {
            "environments": [],
            "playState": "STOPPED",
            "masterVolume": 1,
            "soundboard": []
        }

def save_workspace(workspace: dict):
    """Save the workspace configuration."""
    try:
        logger.debug(f"Saving workspace state: {workspace}")
        # Load existing config to preserve files data
        current_config = {}
        if CONFIG_FILE.exists():
            with open(CONFIG_FILE, 'r') as f:
                try:
                    current_config = json.load(f)
                except json.JSONDecodeError as e:
                    logger.error(f"Error reading existing config: {e}")
                    # If config is corrupted, start fresh
                    current_config = {}
        
        # Create a clean config with only the fields we need
        new_config = {
            "environments": workspace.get("environments", []),
            "playState": workspace.get("playState", "STOPPED"),
            "masterVolume": workspace.get("masterVolume", 1),
            "soundboard": workspace.get("soundboard", []),
            "files": current_config.get("files", [])
        }
            
        # Write the new config
        with open(CONFIG_FILE, 'w') as f:
            # Validate JSON first
            try:
                # Convert to string with pretty printing
                json_str = json.dumps(new_config, indent=2, sort_keys=True)
                f.write(json_str)
            except Exception as e:
                logger.error(f"Error serializing config: {e}")
                raise
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
        
        # Get raw data and decode as UTF-8
        raw_data = request.get_data().decode('utf-8').strip()
        logger.debug(f"Raw data length: {len(raw_data)}")
        logger.debug(f"First 200 chars: {raw_data[:200]}")
        logger.debug(f"Last 200 chars: {raw_data[-200:] if len(raw_data) > 200 else raw_data}")
        
        # Try to parse JSON strictly
        try:
            # First try to parse with strict=False to see if it's valid JSON at all
            workspace = json.loads(raw_data, strict=False)
            logger.debug("Initial JSON parse successful")
            
            # Now try with strict=True to catch any formatting issues
            workspace = json.loads(raw_data, strict=True)
            logger.debug("Strict JSON parse successful")
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            logger.error(f"Error at position {e.pos}, line {e.lineno}, col {e.colno}")
            # Get context around the error position
            start = max(0, e.pos - 100)
            end = min(len(raw_data), e.pos + 100)
            context = raw_data[start:end]
            logger.error(f"Context around error:\n{context}")
            logger.error(f"Error position in context: {e.pos - start}")
            return jsonify({"error": str(e)}), 400
            
        if not isinstance(workspace, dict):
            return jsonify({"error": f"Expected dict, got {type(workspace)}"}), 400
            
        # Validate required fields
        required_fields = {'environments', 'files', 'masterVolume', 'soundboard', 'playState'}
        missing_fields = required_fields - set(workspace.keys())
        if missing_fields:
            return jsonify({"error": f"Missing required fields: {missing_fields}"}), 400
            
        save_workspace(workspace)
        return jsonify({"status": "success"})
    except Exception as e:
        logger.error(f"Error updating workspace: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500 