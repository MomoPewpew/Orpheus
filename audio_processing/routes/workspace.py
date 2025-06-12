from flask import Blueprint, request, jsonify
import json
from pathlib import Path
import logging
from audio_processing.models.audio import AppState, PlayState
from audio_processing.models.mixer import mixer

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
            new_app_state = AppState.from_dict(data)
            
            # Get the current state before updating
            current_state = load_workspace()
            
            # Save the new workspace state
            save_workspace(new_app_state)
            
            # Compare states and get required actions
            compare_workspaces(new_app_state)
            
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

def compare_workspaces(app_state: AppState) -> None:
    """Update the audio mixer based on the current app state.
    
    This function checks if any environments are playing and controls
    the audio processing loop accordingly.
    
    Args:
        app_state: The current application state
    """
    # Log environment states
    for env in app_state.environments:
        logger.debug(f"Environment {env.id} state: {env.play_state}")
    
    # Check if any environments should be playing
    should_play = any(env.play_state == PlayState.PLAYING for env in app_state.environments)
    logger.info(f"Should play audio: {should_play}")
    
    # Get current playing state
    was_playing = mixer._is_running
    logger.info(f"Was playing audio: {was_playing}")
    
    # Start or stop processing based on state change
    if should_play and not was_playing:
        logger.info("Starting audio processing")
        mixer.start_processing(app_state)
    elif was_playing and not should_play:
        logger.info("Stopping audio processing")
        mixer.stop_processing()
    else:
        # Update app state if already running
        logger.debug("Updating app state in mixer")
        with mixer._lock:
            mixer._app_state = app_state