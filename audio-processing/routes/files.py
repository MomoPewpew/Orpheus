from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
import os
from pathlib import Path
from models.sound_file import SoundFile
from typing import List, Optional
import json
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

files_bp = Blueprint('files', __name__)

# Define paths
DATA_DIR = Path(__file__).parent.parent / 'data'
AUDIO_DIR = DATA_DIR / 'audio'
CONFIG_FILE = DATA_DIR / 'config.json'

# Allowed audio file extensions
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'ogg'}

def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_config() -> dict:
    """Load the config file."""
    try:
        if not CONFIG_FILE.exists():
            logger.debug("Config file not found, creating default")
            return {"files": []}
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
            logger.debug(f"Loaded config: {config}")
            return config
    except Exception as e:
        logger.error(f"Error loading config: {e}")
        return {"files": []}

def save_config(config: dict):
    """Save the config file."""
    try:
        logger.debug(f"Saving config: {config}")
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving config: {e}")
        raise

def ensure_directories():
    """Create necessary directories if they don't exist."""
    logger.debug(f"Ensuring directories exist: {DATA_DIR}, {AUDIO_DIR}")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    
    # Create default config if it doesn't exist
    if not CONFIG_FILE.exists():
        logger.debug(f"Creating default config file at {CONFIG_FILE}")
        save_config({"files": []})

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

@files_bp.route('/files', methods=['GET'])
def list_files():
    """List all audio files with optional search."""
    try:
        ensure_directories()  # Ensure directories exist on each request
        search_query = request.args.get('search', '').lower()
        sound_files = get_sound_files()
        
        if search_query:
            sound_files = [
                sf for sf in sound_files 
                if search_query in sf.name.lower() or search_query in sf.original_filename.lower()
            ]
        
        return jsonify([sf.to_dict() for sf in sound_files])
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
        logger.debug(f"Saving uploaded file to: {temp_path}")
        file.save(temp_path)
        
        try:
            # Create SoundFile instance with metadata
            sound_file = SoundFile.from_upload(temp_path, name)
            
            # Update config
            config = load_config()
            config["files"] = config.get("files", []) + [sound_file.to_dict()]
            save_config(config)
            
            return jsonify(sound_file.to_dict())
        except Exception as e:
            # Clean up temp file if it exists
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise e
            
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        return jsonify({"error": str(e)}), 500 