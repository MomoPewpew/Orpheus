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
                logger.debug(f"Loaded raw config: {json.dumps(config, indent=2)}")
                
                # Log environment details before conversion
                for env in config.get('environments', []):
                    logger.debug(f"Environment {env.get('id')} from config:")
                    logger.debug(f"  Presets: {len(env.get('presets', []))}")
                    for preset in env.get('presets', []):
                        logger.debug(f"  Preset: {preset.get('id')} - {preset.get('name')}")
                
                # Create AppState
                logger.debug("Creating AppState from config")
                app_state = AppState.from_dict(config)
                
                # Log environment details after conversion
                logger.debug(f"Created AppState with {len(app_state.environments)} environments")
                for env in app_state.environments:
                    logger.debug(f"Environment {env.id} after loading:")
                    logger.debug(f"  Presets: {len(env.presets)}")
                    for preset in env.presets:
                        logger.debug(f"  Preset: {preset.id} - {preset.name}")
                    logger.debug(f"  Active preset ID: {env.active_preset_id}")
                
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
        logger.debug(f"Saving workspace state with {len(app_state.environments)} environments")
        
        # Convert AppState to dict
        new_config = app_state.to_dict()
        logger.debug(f"New config has {len(new_config['environments'])} environments")
        for env in new_config['environments']:
            logger.debug(f"Environment {env['id']} has {len(env.get('presets', []))} presets")
            for preset in env.get('presets', []):
                logger.debug(f"Preset: {preset['id']} - {preset['name']}")
        
        # Load existing config to preserve files
        current_config = {}
        if CONFIG_FILE.exists():
            with open(CONFIG_FILE, 'r') as f:
                try:
                    current_config = json.load(f)
                    logger.debug(f"Loaded existing config with {len(current_config.get('files', []))} files")
                except json.JSONDecodeError as e:
                    logger.error(f"Error reading existing config: {e}")
                    current_config = {}
        
        # Only update the files from current config, preserve everything else from new config
        new_config['files'] = current_config.get('files', [])
        logger.debug(f"Final config has {len(new_config['environments'])} environments and {len(new_config['files'])} files")
        
        # Verify presets are preserved
        for env in new_config['environments']:
            logger.debug(f"Final environment {env['id']} has {len(env.get('presets', []))} presets")
            for preset in env.get('presets', []):
                logger.debug(f"Final preset: {preset['id']} - {preset['name']}")
            
        # Write the new config
        with open(CONFIG_FILE, 'w') as f:
            # Convert to string with pretty printing
            json_str = json.dumps(new_config, indent=2, sort_keys=True)
            f.write(json_str)
            logger.debug(f"Saved config with {len(new_config['environments'])} environments")
    except Exception as e:
        logger.error(f"Error saving config: {e}", exc_info=True)
        raise

def ensure_workspace_dir():
    """Create necessary directories and files if they don't exist."""
    logger.debug(f"Ensuring workspace directory exists: {DATA_DIR}")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    # Reset all environment playStates to STOPPED on server startup
    if CONFIG_FILE.exists():
        try:
            # Load current config directly to preserve all data
            with open(CONFIG_FILE, 'r') as f:
                config = json.load(f)
                logger.debug(f"STARTUP: Loaded config: {json.dumps(config, indent=2)}")
            
            # Only update play states in the config, being careful to preserve presets
            for env in config.get('environments', []):
                env_id = env.get('id')
                active_preset_id = env.get('activePresetId')
                presets = env.get('presets', [])
                logger.debug(f"STARTUP: Environment {env_id} has {len(presets)} presets and activePresetId {active_preset_id}")
                
                # Update play state
                env['playState'] = 'STOPPED'
                logger.debug(f"STARTUP: Reset play state for environment {env_id}")
                
                # Log all presets to verify they're preserved
                for preset in presets:
                    logger.debug(f"STARTUP: Preserved preset {preset.get('id')} - {preset.get('name')}")
            
            # Write the updated config back
            with open(CONFIG_FILE, 'w') as f:
                json_str = json.dumps(config, indent=2, sort_keys=True)
                f.write(json_str)
                logger.debug("STARTUP: Saved config with reset play states")
                
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
                logger.debug(f"GET: Loaded raw config: {json.dumps(config, indent=2)}")
                
                # Preserve presets for each environment
                for env in config.get('environments', []):
                    env_id = env.get('id')
                    active_preset_id = env.get('activePresetId')
                    presets = env.get('presets', [])
                    logger.debug(f"GET: Environment {env_id} has {len(presets)} presets and activePresetId {active_preset_id}")
                    
                    # If we have an activePresetId but no matching preset, check if the preset exists
                    if active_preset_id and not any(p.get('id') == active_preset_id for p in presets):
                        logger.warning(f"GET: Environment {env_id} has activePresetId {active_preset_id} but no matching preset")
                        # Clear the activePresetId since we can't find the preset
                        env['activePresetId'] = None
                    
                    # Log all presets
                    for preset in presets:
                        logger.debug(f"GET: Found preset {preset.get('id')} - {preset.get('name')}")
                
                # Create AppState from the processed config
                app_state = AppState.from_dict(config)
                
                # Log final state
                for env in app_state.environments:
                    logger.debug(f"GET: Final environment {env.id} state:")
                    logger.debug(f"  Presets: {len(env.presets)}")
                    for preset in env.presets:
                        logger.debug(f"  Preset: {preset.id} - {preset.name}")
                    logger.debug(f"  Active preset ID: {env.active_preset_id}")
                
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
        logger.debug(f"Raw data length: {len(raw_data)}")
        
        # Parse JSON and convert to AppState
        try:
            data = json.loads(raw_data, strict=True)
            logger.debug(f"Parsed data: {json.dumps(data, indent=2)}")
            logger.debug(f"Parsed data has {len(data.get('environments', []))} environments")
            
            # Load current state to preserve presets if needed
            current_state = None
            if CONFIG_FILE.exists():
                with open(CONFIG_FILE, 'r') as f:
                    current_state = json.load(f)
                    logger.debug("Loaded current state for preset preservation")
            
            # Log and validate environment details before processing
            environments = data.get('environments', [])
            for env in environments:
                logger.debug(f"Processing environment {env.get('id')}:")
                active_preset_id = env.get('activePresetId')
                presets = env.get('presets', [])
                logger.debug(f"  Active preset ID: {active_preset_id}")
                logger.debug(f"  Number of presets: {len(presets)}")
                
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
                
                # Log final preset state
                logger.debug(f"  Final presets: {json.dumps(env.get('presets', []), indent=2)}")
            
            # Validate required fields
            if 'environments' not in data:
                raise ValueError("Missing required field: environments")
            if 'masterVolume' not in data:
                raise ValueError("Missing required field: masterVolume")
            if 'soundboard' not in data:
                raise ValueError("Missing required field: soundboard")
            
            # Create new app state
            logger.debug("Creating new AppState from data")
            new_app_state = AppState.from_dict(data)
            logger.debug(f"Created AppState with {len(new_app_state.environments)} environments")
            
            # Log environment details after conversion
            for env in new_app_state.environments:
                logger.debug(f"Environment after processing - ID: {env.id}, Name: {env.name}")
                logger.debug(f"Number of presets: {len(env.presets)}")
                for preset in env.presets:
                    logger.debug(f"Preset after processing - ID: {preset.id}, Name: {preset.name}")
                logger.debug(f"Active preset ID: {env.active_preset_id}")
            
            # Save the new workspace state
            logger.debug("Saving new workspace state")
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