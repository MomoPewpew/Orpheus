import os
import uuid
from dataclasses import dataclass
from typing import Optional
import librosa
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


@dataclass
class SoundFile:
    id: str
    name: str
    path: str
    peak_volume: float
    duration_ms: int
    original_filename: str

    @classmethod
    def from_upload(cls, file_path: str, name: Optional[str] = None) -> 'SoundFile':
        """Create a SoundFile instance from an uploaded file."""
        # Generate random ID
        file_id = str(uuid.uuid4())

        # Get original filename without extension
        original_filename = Path(file_path).stem

        # Use provided name if available, otherwise use original filename
        display_name = name if name is not None and name.strip() else original_filename

        # Load audio file and get metadata
        y, sr = librosa.load(file_path)
        duration_ms = int(librosa.get_duration(y=y, sr=sr) * 1000)
        peak_volume = float(max(abs(y)))

        # Create new path with ID
        new_path = str(Path(file_path).parent / f"{file_id}{Path(file_path).suffix}")

        # Rename file to use ID
        os.rename(file_path, new_path)

        return cls(
            id=file_id,
            name=display_name,
            path=new_path,
            peak_volume=peak_volume,
            duration_ms=duration_ms,
            original_filename=original_filename
        )

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "name": self.name,
            "path": self.path,
            "peak_volume": self.peak_volume,
            "duration_ms": self.duration_ms,
            "original_filename": self.original_filename
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'SoundFile':
        """Create instance from dictionary."""
        try:
            return cls(
                id=data.get("id", str(uuid.uuid4())),
                name=data.get("name", "Unknown"),
                path=data.get("path", ""),
                peak_volume=float(data.get("peak_volume", 1.0)),
                duration_ms=int(data.get("duration_ms", 0)),
                original_filename=data.get("original_filename", data.get("name", "Unknown"))
            )
        except Exception as e:
            logger.error(f"Error creating SoundFile from dict: {data} - {str(e)}")
            # Return a placeholder sound file
            return cls(
                id=str(uuid.uuid4()),
                name="Error Loading Sound",
                path="",
                peak_volume=1.0,
                duration_ms=0,
                original_filename="Error Loading Sound"
            )
