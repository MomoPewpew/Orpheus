from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
import os
from pathlib import Path
from models.sound_file import SoundFile
from typing import List
import json
import logging
import fcntl
import time
from contextlib import contextmanager

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

files_bp = Blueprint('files', __name__)

# Define paths
DATA_DIR = Path(__file__).parent.parent / 'data'
AUDIO_DIR = DATA_DIR / 'audio'
CONFIG_FILE = DATA_DIR / 'config.json'
LOCK_FILE = DATA_DIR / 'config.lock'

# Allowed audio file extensions
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'ogg'}


@contextmanager
def filelock():
    """Context manager for file locking to prevent race conditions."""
    lock_file = None
    try:
        # Ensure the lock file's directory exists
        LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
        
        # Create the lock file if it doesn't exist
        if not LOCK_FILE.exists():
            LOCK_FILE.touch()

        # Open the lock file in append mode
        lock_file = open(LOCK_FILE, 'a')

        # Try to acquire lock, wait up to 5 seconds
        start_time = time.time()
        while True:
            try:
                # Try to acquire an exclusive lock
                fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except IOError:
                if time.time() - start_time > 5:
                    raise TimeoutError("Could not acquire lock after 5 seconds")
                time.sleep(0.1)

        yield
    finally:
        if lock_file:
            # Release the lock and close the file
            fcntl.flock(lock_file, fcntl.LOCK_UN)
            lock_file.close()


def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_default_config():
    """Get the default configuration."""
    return {
        "files": [],
        "environments": [],
        "masterVolume": 1.0,
        "soundboard": [],
        "effects": {
            "normalize": {"enabled": True},
            "fades": {"fadeInDuration": 4000, "crossfadeDuration": 4000},
            "filters": {
                "highPass": {"frequency": 0},
                "lowPass": {"frequency": 20000},
                "dampenSpeechRange": {"amount": 0}
            },
            "compressor": {
                "lowThreshold": -40,
                "highThreshold": 0,
                "ratio": 1
            }
        }
    }


def load_config() -> dict:
    """Load the config file with file locking."""
    try:
        with filelock():
            if not CONFIG_FILE.exists():
                logger.debug("Config file not found, creating default")
                default_config = get_default_config()
                # Write the default config to file
                with open(CONFIG_FILE, 'w') as f:
                    json.dump(default_config, f, indent=2)
                return default_config

            # Read the file content first to check if it's empty
            with open(CONFIG_FILE, 'r') as f:
                content = f.read().strip()

            if not content:
                logger.warning("Config file exists but is empty, creating default")
                default_config = get_default_config()
                # Write the default config to file
                with open(CONFIG_FILE, 'w') as f:
                    json.dump(default_config, f, indent=2)
                return default_config

            try:
                # Try to parse the content as JSON
                config = json.loads(content)

                # Validate required fields
                if not isinstance(config, dict):
                    raise ValueError("Config must be a JSON object")

                # Ensure required sections exist
                config.setdefault("files", [])
                config.setdefault("environments", [])
                config.setdefault("masterVolume", 1.0)
                config.setdefault("soundboard", [])
                config.setdefault("effects", get_default_config()["effects"])

                return config

            except json.JSONDecodeError as e:
                logger.error(f"Config file contains invalid JSON: {e}")
                logger.error(f"Content: {content[:100]}...")  # Log first 100 chars of content

                # Backup the corrupted file
                backup_path = CONFIG_FILE.with_suffix(f'.bak.{int(time.time())}')
                logger.warning(f"Backing up corrupted config to {backup_path}")
                with open(backup_path, 'w') as f:
                    f.write(content)

                # Return default config and write it
                default_config = get_default_config()
                with open(CONFIG_FILE, 'w') as f:
                    json.dump(default_config, f, indent=2)
                return default_config

    except Exception as e:
        logger.error(f"Error loading config: {e}", exc_info=True)
        return get_default_config()


def save_config(config: dict):
    """Save the config file with file locking."""
    try:
        with filelock():
            # Load existing config to preserve other state
            current_config = {}
            if CONFIG_FILE.exists():
                try:
                    with open(CONFIG_FILE, 'r') as f:
                        content = f.read().strip()
                        if content:
                            current_config = json.loads(content)
                except json.JSONDecodeError:
                    logger.error("Error reading existing config, starting fresh")
                    current_config = {}

            # Update only the fields that were passed in, preserve the rest
            merged_config = {**current_config, **config}

            # Write atomically by writing to temp file first
            temp_file = CONFIG_FILE.with_suffix('.tmp')
            with open(temp_file, 'w') as f:
                json.dump(merged_config, f, indent=2)

            # Rename temp file to actual config file (atomic operation)
            os.replace(temp_file, CONFIG_FILE)

    except Exception as e:
        logger.error(f"Error saving config: {e}", exc_info=True)
        raise


def ensure_directories():
    """Create necessary directories if they don't exist."""
    try:
        # Create directories without locking first
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        AUDIO_DIR.mkdir(parents=True, exist_ok=True)

        # Now use the lock to create/update the config file
        with filelock():
            # Create default config if it doesn't exist
            if not CONFIG_FILE.exists():
                logger.debug(f"Creating default config file at {CONFIG_FILE}")
                # Write the default config directly here instead of calling save_config
                # to avoid potential recursive lock acquisition
                with open(CONFIG_FILE, 'w') as f:
                    json.dump(get_default_config(), f, indent=2)
    except Exception as e:
        logger.error(f"Error ensuring directories: {e}", exc_info=True)
        raise


# Call this when the blueprint is created
ensure_directories()


def get_sound_files() -> List[SoundFile]:
    """Get all sound files from config."""
    try:
        config = load_config()
        return [SoundFile.from_dict(file_data) for file_data in config.get("files", [])]
    except Exception as e:
        logger.error(f"Error getting sound files: {e}")
        return []


def count_file_usage(file_id: str, config: dict) -> int:
    """Count how many times a file is used in environments (layers and soundboards)."""
    usage_count = 0

    for env in config.get("environments", []):
        # Check layers
        for layer in env.get("layers", []):
            for sound in layer.get("sounds", []):
                if sound.get("fileId") == file_id:
                    usage_count += 1

        # Check soundboard - these are direct string IDs
        for sound_id in env.get("soundboard", []):
            if isinstance(sound_id, str) and sound_id == file_id:
                usage_count += 1

    # Check global soundboard if it exists
    for sound_id in config.get("soundboard", []):
        if isinstance(sound_id, str) and sound_id == file_id:
            usage_count += 1

    return usage_count


@files_bp.route('/files', methods=['GET'])
def list_files():
    """List all audio files with optional search."""
    try:
        ensure_directories()  # Ensure directories exist on each request
        search_query = request.args.get('search', '').lower()
        config = load_config()
        sound_files = get_sound_files()

        if search_query:
            sound_files = [
                sf for sf in sound_files
                if search_query in sf.name.lower() or search_query in sf.original_filename.lower()
            ]

        # Add usage count to each file
        result = []
        for sf in sound_files:
            file_dict = sf.to_dict()
            file_dict["usageCount"] = count_file_usage(sf.id, config)
            result.append(file_dict)

        return jsonify(result)
    except Exception as e:
        logger.error(f"Error listing files: {e}")
        return jsonify({"error": str(e)}), 500


@files_bp.route('/files/<file_id>', methods=['GET'])
def get_file(file_id):
    """Get a specific audio file by ID."""
    try:
        ensure_directories()  # Ensure directories exist on each request
        sound_files = get_sound_files()
        for sf in sound_files:
            if sf.id == file_id:
                if os.path.exists(sf.path):
                    return send_file(sf.path)
                else:
                    logger.error(f"File not found at path: {sf.path}")
                    return jsonify({"error": "File not found on disk"}), 404
        return jsonify({"error": "File not found in config"}), 404
    except Exception as e:
        logger.error(f"Error getting file: {e}")
        return jsonify({"error": str(e)}), 500


@files_bp.route('/files/<file_id>', methods=['DELETE'])
def delete_file(file_id):
    """Delete a specific audio file by ID."""
    try:
        ensure_directories()  # Ensure directories exist on each request
        config = load_config()

        # Check if file is in use
        usage_count = count_file_usage(file_id, config)
        if usage_count > 0:
            return jsonify({
                "error": f"Cannot delete file that is in use ({usage_count} uses)"
            }), 400

        # Find the file in config
        file_data = None
        remaining_files = []
        for f in config.get("files", []):
            if f["id"] == file_id:
                file_data = f
            else:
                remaining_files.append(f)

        if not file_data:
            return jsonify({"error": "File not found"}), 404

        # Delete the actual file
        file_path = Path(file_data["path"])
        if file_path.exists():
            os.remove(file_path)

        # Update config without the deleted file
        config["files"] = remaining_files
        save_config(config)

        return jsonify({"status": "success"})
    except Exception as e:
        logger.error(f"Error deleting file: {e}")
        return jsonify({"error": str(e)}), 500


@files_bp.route('/files', methods=['POST'])
def upload_file():
    """Upload a new audio file."""
    try:
        ensure_directories()  # Ensure directories exist on each request

        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400

        file = request.files['file']
        name = request.form.get('name')

        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400

        if not allowed_file(file.filename):
            return jsonify({"error": "File type not allowed"}), 400

        # Save uploaded file temporarily
        filename = secure_filename(file.filename)
        temp_path = str(AUDIO_DIR / filename)
        file.save(temp_path)

        try:
            # Create SoundFile instance with metadata
            sound_file = SoundFile.from_upload(temp_path, name)

            # Update config, preserving other state
            config = load_config()
            config["files"] = config.get("files", []) + [sound_file.to_dict()]
            save_config({"files": config["files"]})  # Only update the files array

            return jsonify(sound_file.to_dict())
        except Exception as e:
            # Clean up temp file if it exists
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise e

    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        return jsonify({"error": str(e)}), 500
