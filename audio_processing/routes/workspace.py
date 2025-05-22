from flask import Blueprint, request, jsonify
import json
import os
from pathlib import Path
import logging
from audio_processing.models.audio import AppState, Environment, PlayState

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

workspace_bp = Blueprint('workspace', __name__)

# Define paths
DATA_DIR = Path(__file__).parent.parent / 'data'
CONFIG_FILE = DATA_DIR / 'config.json'

def load_workspace() -> AppState:
    """Load the workspace configuration."""
    try:
        if not CONFIG_FILE.exists():
            logger.debug("Config file not found, creating default")
            return AppState(
                environments=[],
                master_volume=1.0,
                soundboard=[],
                effects={
                    "normalize": { "enabled": True },
                    "fades": { "fadeInDuration": 4000, "crossfadeDuration": 4000 },
                    "filters": {
                        "highPass": { "frequency": 400 },
                        "lowPass": { "frequency": 10000 },
                        "dampenSpeechRange": { "amount": 0 }
                    },
                    "compressor": {
                        "lowThreshold": -40,
                        "highThreshold": 0,
                        "ratio": 1
                    }
                }
            )
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
            logger.debug(f"Loaded config: {config}")
            app_state = AppState.from_dict(config)
            logger.debug(f"Number of environments loaded: {len(app_state.environments)}")
            return app_state
    except Exception as e:
        logger.error(f"Error loading config: {e}")
        return AppState(
            environments=[],
            master_volume=1.0,
            soundboard=[],
            effects={
                "normalize": { "enabled": True },
                "fades": { "fadeInDuration": 4000, "crossfadeDuration": 4000 },
                "filters": {
                    "highPass": { "frequency": 400 },
                    "lowPass": { "frequency": 10000 },
                    "dampenSpeechRange": { "amount": 0 }
                },
                "compressor": {
                    "lowThreshold": -40,
                    "highThreshold": 0,
                    "ratio": 1
                }
            }
        )

def save_workspace(app_state: AppState):
    """Save the workspace configuration."""
    try:
        logger.debug(f"Saving workspace state with {len(app_state.environments)} environments")
        
        # Load existing config to preserve files data
        current_config = {}
        if CONFIG_FILE.exists():
            with open(CONFIG_FILE, 'r') as f:
                try:
                    current_config = json.load(f)
                except json.JSONDecodeError as e:
                    logger.error(f"Error reading existing config: {e}")
                    current_config = {}
        
        # Convert AppState to dict and merge with existing files
        new_config = app_state.to_dict()
        new_config['files'] = current_config.get('files', [])
            
        # Write the new config
        with open(CONFIG_FILE, 'w') as f:
            # Convert to string with pretty printing
            json_str = json.dumps(new_config, indent=2, sort_keys=True)
            f.write(json_str)
            logger.debug(f"Saved config with {len(new_config['environments'])} environments")
    except Exception as e:
        logger.error(f"Error saving config: {e}")
        raise

def ensure_workspace_dir():
    """Create necessary directories and files if they don't exist."""
    logger.debug(f"Ensuring workspace directory exists: {DATA_DIR}")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    # Reset all environment playStates to STOPPED on server startup
    if CONFIG_FILE.exists():
        try:
            app_state = load_workspace()
            
            # Update all environments to STOPPED state
            for env in app_state.environments:
                env.play_state = PlayState.STOPPED
                
            # Save the updated state
            save_workspace(app_state)
        except Exception as e:
            logger.error(f"Error resetting play states: {e}")

# Call this when the blueprint is created
ensure_workspace_dir()

@workspace_bp.route('/workspace', methods=['GET'])
def get_workspace():
    """Get the current workspace state."""
    try:
        app_state = load_workspace()
        return jsonify(app_state.to_dict())
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
        
        # Parse JSON and convert to AppState
        try:
            data = json.loads(raw_data, strict=True)
            logger.debug(f"Number of environments in incoming JSON: {len(data.get('environments', []))}")
            app_state = AppState.from_dict(data)
            logger.debug(f"Number of environments after parsing: {len(app_state.environments)}")
            save_workspace(app_state)
            return jsonify({"status": "success"})
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            logger.error(f"Error at position {e.pos}, line {e.lineno}, col {e.colno}")
            return jsonify({"error": f"Invalid JSON: {str(e)}"}), 400
        except Exception as e:
            logger.error(f"Error processing workspace update: {e}")
            return jsonify({"error": str(e)}), 500
            
    except Exception as e:
        logger.error(f"Error updating workspace: {e}")
        return jsonify({"error": str(e)}), 500 