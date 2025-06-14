from flask import Blueprint, request, jsonify
import json
from pathlib import Path
import logging
from audio_processing.models.audio import AppState, PlayState, Effects
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
            default_effects_dict = {
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
            return AppState(
                environments=[],
                master_volume=1.0,
                soundboard=[],
                effects=Effects.from_dict(default_effects_dict)
            )
            
        with open(CONFIG_FILE, 'r') as f:
            try:
                config = json.load(f)
                
                # Create AppState
                app_state = AppState.from_dict(config)
                
                return app_state
                
            except json.JSONDecodeError as e:
                logger.error(f"Error decoding config JSON: {e}", exc_info=True)
                raise
            except Exception as e:
                logger.error(f"Error creating AppState from config: {e}", exc_info=True)
                raise
                
    except Exception as e:
        logger.error(f"Error loading config: {e}", exc_info=True)
        default_effects_dict = {
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
        return AppState(
            environments=[],
            master_volume=1.0,
            soundboard=[],
            effects=Effects.from_dict(default_effects_dict)
        )

def save_workspace(app_state: AppState):
    """Save the workspace configuration."""
    try:        
        # Convert AppState to dict
        new_config = app_state.to_dict()
        
        # Load existing config to preserve files
        current_config = {}
        if CONFIG_FILE.exists():
            with open(CONFIG_FILE, 'r') as f:
                try:
                    current_config = json.load(f)
                except json.JSONDecodeError as e:
                    logger.error(f"Error reading existing config: {e}")
                    current_config = {}
        
        # Only update the files from current config, preserve everything else from new config
        new_config['files'] = current_config.get('files', [])
            
        # Write the new config
        with open(CONFIG_FILE, 'w') as f:
            # Convert to string with pretty printing
            json_str = json.dumps(new_config, indent=2, sort_keys=True)
            f.write(json_str)
    except Exception as e:
        logger.error(f"Error saving config: {e}", exc_info=True)
        raise

def ensure_workspace_dir():
    """Create necessary directories and files if they don't exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    # Reset all environment playStates to STOPPED on server startup
    if CONFIG_FILE.exists():
        try:
            # Load current config directly to preserve all data
            with open(CONFIG_FILE, 'r') as f:
                config = json.load(f)
            
            # Only update play states in the config, being careful to preserve presets
            for env in config.get('environments', []):
                env_id = env.get('id')
                active_preset_id = env.get('activePresetId')
                presets = env.get('presets', [])
                
                # Update play state
                env['playState'] = 'STOPPED'

            # Write the updated config back
            with open(CONFIG_FILE, 'w') as f:
                json_str = json.dumps(config, indent=2, sort_keys=True)
                f.write(json_str)
                
        except Exception as e:
            logger.error(f"Error resetting play states: {e}", exc_info=True)

# Call this when the blueprint is created
ensure_workspace_dir()

@workspace_bp.route('/workspace', methods=['GET'])
def get_workspace():
    """Get the current workspace state."""
    try:
        # Load raw config first
        if CONFIG_FILE.exists():
            with open(CONFIG_FILE, 'r') as f:
                config = json.load(f)
                
                # Preserve presets for each environment
                for env in config.get('environments', []):
                    env_id = env.get('id')
                    active_preset_id = env.get('activePresetId')
                    presets = env.get('presets', [])
                    
                    # If we have an activePresetId but no matching preset, check if the preset exists
                    if active_preset_id and not any(p.get('id') == active_preset_id for p in presets):
                        logger.warning(f"GET: Environment {env_id} has activePresetId {active_preset_id} but no matching preset")
                        # Clear the activePresetId since we can't find the preset
                        env['activePresetId'] = None
                
                # Create AppState from the processed config
                app_state = AppState.from_dict(config)
                
                return jsonify(app_state.to_dict())
        else:
            logger.debug("GET: Config file not found, creating default")
            default_effects_dict = {
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
            app_state = AppState(
                environments=[],
                master_volume=1.0,
                soundboard=[],
                effects=Effects.from_dict(default_effects_dict)
            )
            return jsonify(app_state.to_dict())
            
    except Exception as e:
        logger.error(f"Error getting workspace: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@workspace_bp.route('/workspace', methods=['POST'])
def update_workspace():
    """Update the workspace state."""
    try:
        ensure_workspace_dir()
        
        # Get raw data and decode as UTF-8
        raw_data = request.get_data().decode('utf-8').strip()
        
        # Parse JSON and convert to AppState
        try:
            data = json.loads(raw_data, strict=True)
            
            # Load current state to preserve presets if needed
            current_state = None
            if CONFIG_FILE.exists():
                with open(CONFIG_FILE, 'r') as f:
                    current_state = json.load(f)
            
            # Log and validate environment details before processing
            environments = data.get('environments', [])
            for env in environments:
                active_preset_id = env.get('activePresetId')
                presets = env.get('presets', [])
                
                # If we have an activePresetId but no matching preset, try to recover it
                if active_preset_id and not any(p.get('id') == active_preset_id for p in presets):
                    logger.warning(f"Environment {env['id']} has activePresetId {active_preset_id} but no matching preset")
                    if current_state:
                        # Find the environment in current state
                        current_env = next((e for e in current_state.get('environments', []) 
                                          if e.get('id') == env['id']), None)
                        if current_env:
                            # Find the missing preset
                            missing_preset = next((p for p in current_env.get('presets', [])
                                                 if p.get('id') == active_preset_id), None)
                            if missing_preset:
                                logger.info(f"Recovered preset {active_preset_id} from current state")
                                if 'presets' not in env:
                                    env['presets'] = []
                                env['presets'].append(missing_preset)
                            else:
                                logger.warning(f"Could not find preset {active_preset_id} in current state")
                                env['activePresetId'] = None
                        else:
                            logger.warning(f"Could not find environment {env['id']} in current state")
                            env['activePresetId'] = None
                    else:
                        logger.warning("No current state available to recover preset from")
                        env['activePresetId'] = None
            
            # Validate required fields
            if 'environments' not in data:
                raise ValueError("Missing required field: environments")
            if 'masterVolume' not in data:
                raise ValueError("Missing required field: masterVolume")
            if 'soundboard' not in data:
                raise ValueError("Missing required field: soundboard")
            
            # Create new app state
            new_app_state = AppState.from_dict(data)
            
            # Save the new workspace state
            save_workspace(new_app_state)
            
            # Compare states and get required actions
            compare_workspaces(new_app_state)
            
            return jsonify({"status": "success"})
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            logger.error(f"Error at position {e.pos}, line {e.lineno}, col {e.colno}")
            return jsonify({"error": f"Invalid JSON: {str(e)}"}), 400
        except ValueError as e:
            logger.error(f"Validation error: {str(e)}")
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            logger.error(f"Error processing workspace update: {e}", exc_info=True)
            return jsonify({"error": str(e)}), 500
            
    except Exception as e:
        logger.error(f"Error updating workspace: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

def compare_workspaces(app_state: AppState) -> None:
    """Update the audio mixer based on the current app state.
    
    This function checks if any environments are playing and controls
    the audio processing loop accordingly.
    
    Args:
        app_state: The current application state
    """    
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
        with mixer._lock:
            mixer._app_state = app_state