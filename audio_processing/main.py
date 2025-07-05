from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import json
from pathlib import Path
from typing import Dict, Any

app = FastAPI()

# Data directories
DATA_DIR = Path("data")
CONFIG_FILE = DATA_DIR / "config.json"
AUDIO_DIR = DATA_DIR / "audio"
STATIC_DIR = Path("static")  # Frontend build files will be here

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
AUDIO_DIR.mkdir(exist_ok=True)

# CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with actual origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve audio files
app.mount("/audio", StaticFiles(directory=str(AUDIO_DIR)), name="audio")

# Serve frontend static files - Create React App structure
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


def load_config() -> Dict[str, Any]:
    """Load configuration from file"""
    if not CONFIG_FILE.exists():
        return {"environments": [], "files": []}

    with open(CONFIG_FILE, 'r') as f:
        return json.load(f)


def save_config(config: Dict[str, Any]) -> None:
    """Save configuration to file"""
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)


@app.get("/api/config")
async def get_config():
    """Get the current configuration"""
    return load_config()


@app.post("/api/config")
async def update_config(config: Dict[str, Any]):
    """Update the configuration"""
    save_config(config)
    return {"status": "success"}


@app.post("/api/audio/upload")
async def upload_audio(file: UploadFile = File(...)):
    """Handle audio file upload"""
    file_path = AUDIO_DIR / file.filename

    # Save the uploaded file
    with open(file_path, 'wb') as f:
        content = await file.read()
        f.write(content)

    # TODO: Analyze audio file for peak volume and length
    # For now, return dummy values
    audio_file = {
        "id": file.filename,  # In production, generate proper ID
        "name": file.filename,
        "path": f"/audio/{file.filename}",
        "peakVolume": 1.0,
        "lengthMs": 0  # TODO: Calculate actual length
    }

    # Update config with new file
    config = load_config()
    config["files"].append(audio_file)
    save_config(config)

    return audio_file


@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    """Serve frontend files or index.html for client-side routing"""
    # First check if the file exists in static directory
    requested_path = STATIC_DIR / full_path
    if requested_path.is_file():
        return FileResponse(requested_path)

    # Otherwise serve index.html for client-side routing
    return FileResponse(STATIC_DIR / "index.html")

