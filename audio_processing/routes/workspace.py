from flask import Blueprint, request, jsonify, current_app
import json
from pathlib import Path
import logging
from audio_processing.models.audio import AppState, PlayState, Effects
from audio_processing.models.mixer import mixer
from audio_processing.routes.files import file_lock, get_default_config
import os
import random

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
        with file_lock():
            if not CONFIG_FILE.exists():
                logger.debug("Config file not found, creating default")
                default_config = get_default_config()
                with open(CONFIG_FILE, 'w') as f:
                    json.dump(default_config, f, indent=2)
                return AppState.from_dict(default_config)
                
            # Read the file content first to check if it's empty
            with open(CONFIG_FILE, 'r') as f:
                content = f.read().strip()
                
            if not content:
                logger.debug("Config file empty, creating default")
                default_config = get_default_config()
                with open(CONFIG_FILE, 'w') as f:
                    json.dump(default_config, f, indent=2)
                return AppState.from_dict(default_config)
                
            try:
                config = json.loads(content)
                
                # Create AppState
                app_state = AppState.from_dict(config)
                
                return app_state
                
            except json.JSONDecodeError as e:
                logger.error(f"Error decoding config JSON: {e}", exc_info=True)
                
                # Backup corrupted file
                import time
                backup_path = CONFIG_FILE.with_suffix(f'.bak.{int(time.time())}')
                logger.warning(f"Backing up corrupted config to {backup_path}")
                with open(backup_path, 'w') as f:
                    f.write(content)
                
                # Create new default config
                default_config = get_default_config()
                with open(CONFIG_FILE, 'w') as f:
                    json.dump(default_config, f, indent=2)
                return AppState.from_dict(default_config)
                
    except Exception as e:
        logger.error(f"Error loading config: {e}", exc_info=True)
        return AppState.from_dict(get_default_config())

def save_workspace(app_state: AppState):
    """Save the workspace configuration."""
    try:
        with file_lock():
            # Convert AppState to dict
            new_config = app_state.to_dict()
            
            # Load existing config to preserve files
            current_config = {}
            if CONFIG_FILE.exists():
                with open(CONFIG_FILE, 'r') as f:
                    content = f.read().strip()
                    if content:
                        try:
                            current_config = json.loads(content)
                        except json.JSONDecodeError as e:
                            logger.error(f"Error reading existing config: {e}")
                            current_config = {}
            
            # Only update the files from current config, preserve everything else from new config
            new_config['files'] = current_config.get('files', [])
                
            # Write atomically using a temp file
            temp_file = CONFIG_FILE.with_suffix('.tmp')
            with open(temp_file, 'w') as f:
                json_str = json.dumps(new_config, indent=2, sort_keys=True)
                f.write(json_str)
                
            # Atomic rename
            os.replace(temp_file, CONFIG_FILE)
            
    except Exception as e:
        logger.error(f"Error saving config: {e}", exc_info=True)
        raise

def ensure_workspace_dir():
    """Create necessary directories and files if they don't exist."""
    try:
        with file_lock():
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            
            # Reset all environment playStates to STOPPED on server startup
            if CONFIG_FILE.exists():
                # Load current config directly to preserve all data
                with open(CONFIG_FILE, 'r') as f:
                    content = f.read().strip()
                    if not content:
                        config = get_default_config()
                    else:
                        try:
                            config = json.loads(content)
                        except json.JSONDecodeError:
                            logger.error("Error reading config, using default")
                            config = get_default_config()
                
                # Only update play states in the config, being careful to preserve presets
                for env in config.get('environments', []):
                    env_id = env.get('id')
                    active_preset_id = env.get('activePresetId')
                    presets = env.get('presets', [])
                    
                    # Update play state
                    env['playState'] = 'STOPPED'

                # Write the updated config back atomically
                temp_file = CONFIG_FILE.with_suffix('.tmp')
                with open(temp_file, 'w') as f:
                    json_str = json.dumps(config, indent=2, sort_keys=True)
                    f.write(json_str)
                    
                # Atomic rename
                os.replace(temp_file, CONFIG_FILE)
            else:
                # Create default config if it doesn't exist
                with open(CONFIG_FILE, 'w') as f:
                    json.dump(get_default_config(), f, indent=2)
                    
    except Exception as e:
        logger.error(f"Error ensuring workspace directory: {e}", exc_info=True)

# Call this when the blueprint is created
ensure_workspace_dir()

@workspace_bp.route('/workspace', methods=['GET'])
def get_workspace():
    """Get the current workspace state."""
    try:
        # Use pre-loaded workspace if available
        if hasattr(current_app, 'workspace') and current_app.workspace is not None:
            logger.debug("Using pre-loaded workspace")
            return jsonify(current_app.workspace.to_dict())
            
        # Otherwise load workspace from file
        logger.debug("Pre-loaded workspace not available, loading from file")
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
                    "highPass": { "frequency": 0 },
                    "lowPass": { "frequency": 20000 },
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
                    current_config = json.load(f)
                    # We'll use this state only for preset recovery
                    config_state = AppState.from_dict(current_config)
            
            # Get the actual previous state from the mixer for state comparison
            current_state = mixer._app_state if mixer._app_state else config_state
            
            # Log and validate environment details before processing
            environments = data.get('environments', [])
            for env in environments:
                active_preset_id = env.get('activePresetId')
                presets = env.get('presets', [])
                
                # If we have an activePresetId but no matching preset, try to recover it
                if active_preset_id and not any(p.get('id') == active_preset_id for p in presets):
                    logger.warning(f"Environment {env['id']} has activePresetId {active_preset_id} but no matching preset")
                    if config_state:  # Use config_state for preset recovery
                        # Find the environment in current state
                        current_env = next((e for e in config_state.environments 
                                          if e.id == env['id']), None)
                        if current_env:
                            # Find the missing preset
                            missing_preset = next((p for p in current_env.presets
                                                 if p.id == active_preset_id), None)
                            if missing_preset:
                                logger.info(f"Recovered preset {active_preset_id} from current state")
                                if 'presets' not in env:
                                    env['presets'] = []
                                env['presets'].append(missing_preset.to_dict())
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
            compare_workspaces(current_state, new_app_state)
            
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

def compare_workspaces(prev_state: AppState, new_state: AppState) -> None:
    """Update the audio mixer based on comparing the previous and new app states.
    
    This function compares the two states to detect transitions and handle:
    - Starting/stopping audio processing
    - Environment fade-ins and fade-outs
    - Crossfades between environments
    - Layer-level fading for:
        - Volume changes
        - Layers starting to play due to chance/cooldown/weight changes
        - Layers stopping due to chance/cooldown/weight changes
    
    Args:
        prev_state: The previous application state
        new_state: The new application state to transition to
    """
    # Check if any environments should be playing (including those that are fading)
    should_play = any(env.play_state == PlayState.PLAYING or env.is_fading for env in new_state.environments)
    was_playing = any(env.play_state == PlayState.PLAYING for env in prev_state.environments) if prev_state else False
    logger.info(f"Should play audio: {should_play}, Was playing: {was_playing}")
    
    # Check for state changes in each environment
    # First identify all environments that are transitioning
    transitions = []
    for new_env in new_state.environments:
        prev_env = next((e for e in prev_state.environments if e.id == new_env.id), None) if prev_state else None
        if prev_env and prev_env.play_state != new_env.play_state:
            transitions.append({
                'env': new_env,
                'from_state': prev_env.play_state,
                'to_state': new_env.play_state
            })
    
    # Check for crossfade scenario - one env stopping while another starts
    is_crossfade = len(transitions) == 2 and any(
        t1['from_state'] == PlayState.PLAYING and t1['to_state'] == PlayState.STOPPED and
        t2['from_state'] == PlayState.STOPPED and t2['to_state'] == PlayState.PLAYING
        for t1, t2 in [(transitions[0], transitions[1]), (transitions[1], transitions[0])]
    )

    # Handle transitions with crossfade awareness
    for transition in transitions:
        env = transition['env']
        from_state = transition['from_state']
        to_state = transition['to_state']
        
        if from_state == PlayState.PLAYING and to_state == PlayState.STOPPED:
            logger.info(f"Environment {env.id} transitioning to stopped - starting fade out")
            env.start_fade()
        elif from_state == PlayState.STOPPED and to_state == PlayState.PLAYING:
            if is_crossfade:
                logger.info(f"Environment {env.id} transitioning to playing with crossfade")
                env.start_fade()
            else:
                logger.info(f"Environment {env.id} transitioning to playing without fade")
                env.update_fade_state()
    
    # Handle layer-level transitions
    if prev_state:
        for new_env in new_state.environments:
            prev_env = next((e for e in prev_state.environments if e.id == new_env.id), None)
            if not prev_env:
                continue
            
            # Compare each layer
            for new_layer in new_env.layers:
                prev_layer = next((l for l in prev_env.layers if l.id == new_layer.id), None)
                if not prev_layer:
                    continue
                    
                # Get the currently active sound for this layer
                new_active_sound = new_layer.sounds[new_layer.selected_sound_index] if new_layer.sounds else None
                prev_active_sound = prev_layer.sounds[prev_layer.selected_sound_index] if prev_layer.sounds else None
                
                if not new_active_sound or not prev_active_sound:
                    continue
                
                # Check if volume has changed for active sound
                if new_active_sound._effective_volume != prev_active_sound._effective_volume:
                    logger.info(f"Layer {new_layer.id} volume changed from {prev_active_sound._effective_volume} to {new_active_sound._effective_volume}")
                    new_active_sound.start_fade_in(prev_active_sound._effective_volume)
                
                # Check if layer should start/stop playing based on chance/cooldown/weight
                # Get the LayerInfo from mixer's cache if it exists
                layer_info = None
                for cache_key in mixer._cached_layers:
                    if cache_key.startswith(f"{new_layer.id}_"):
                        layer_info = mixer._cached_layers[cache_key]
                        break
                
                # If the layer info is not in the cache, skip the transition
                if not layer_info:
                    continue
                
                free_weight = layer_info._free_weight

                new_should_play = new_layer.should_play(
                    rolled_chance=layer_info._chance_roll,
                    passed_cooldown_cycles=layer_info._cooldown_cycles_elapsed,
                    weight_left=free_weight
                )
                
                prev_should_play = prev_layer.should_play(
                    rolled_chance=layer_info._chance_roll,
                    passed_cooldown_cycles=layer_info._cooldown_cycles_elapsed,
                    weight_left=free_weight
                )
                
                # Handle layer start/stop transitions
                if not prev_should_play and new_should_play:
                    logger.info(f"Layer {new_layer.id} starting to play - fading in")
                    new_active_sound.start_fade_in(0.0)
                elif prev_should_play and not new_should_play:
                    logger.info(f"Layer {new_layer.id} stopping - fading out")
                    new_active_sound.start_fade_out()
    
    # Start processing if needed and update state
    if should_play and not mixer._is_running:
        logger.info("Starting audio processing")
        mixer.start_processing(new_state)
    elif mixer._is_running:
        # Just update the app state, let mixer handle stopping itself
        with mixer._lock:
            mixer._app_state = new_state

@workspace_bp.route('/soundboard/play/<sound_id>', methods=['POST'])
def play_soundboard_sound(sound_id: str):
    """Play a sound from the soundboard.
    
    Args:
        sound_id: ID of the sound file to play
    """
    try:
        # Load current app state to ensure volume settings are applied
        app_state = load_workspace()
        
        # Start audio processing if not running
        if not mixer._is_running:
            mixer.start_processing(app_state)
        else:
            # Just update the app state if already running
            with mixer._lock:
                mixer._app_state = app_state
        
        # Play the sound
        mixer.play_soundboard_sound(sound_id)
        
        return jsonify({"success": True})
        
    except Exception as e:
        logger.error(f"Error playing soundboard sound: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500