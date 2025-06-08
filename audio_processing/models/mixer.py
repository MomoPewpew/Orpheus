import logging
import io
import os
from math import log10
from pathlib import Path
from typing import List, Dict, Any
from pydub import AudioSegment
from .discord import queue_audio

logger = logging.getLogger(__name__)

# Define audio file directory
AUDIO_DIR = Path(__file__).parent.parent / 'data' / 'audio'

class AudioMixer:
    """Handles mixing and streaming of audio layers."""
    
    def __init__(self):
        """Initialize the audio mixer."""
        self._environments: Dict[int, Dict[str, Any]] = {}  # guild_id -> environment data
        
    def play_environment(self, guild_id: int, environment_data: Dict[str, Any]) -> bool:
        """Mix and play all active layers in an environment.
        
        Args:
            guild_id: The Discord guild ID to play the audio in
            environment_data: The environment configuration containing layers
            
        Returns:
            bool: True if audio was queued successfully, False otherwise
        """
        try:
            logger.info(f"Playing environment in guild {guild_id}")
            
            # Get all layers from the environment
            layers = environment_data.get('layers', [])
            if not layers:
                logger.warning("No layers found in environment")
                return False
                
            # Initialize the mixed audio with the first layer's first sound
            mixed_audio = None
            
            for layer in layers:
                # Get the first sound from each layer
                sounds = layer.get('sounds', [])
                if not sounds:
                    logger.debug(f"No sounds found in layer {layer.get('name', 'unnamed')}")
                    continue
                    
                first_sound = sounds[0]
                file_id = first_sound.get('fileId')
                if not file_id:
                    logger.warning(f"No file ID for sound in layer {layer.get('name', 'unnamed')}")
                    continue
                
                # Construct the file path
                sound_path = AUDIO_DIR / f"{file_id}.mp3"
                if not sound_path.exists():
                    logger.warning(f"Audio file not found at {sound_path}")
                    continue
                
                try:
                    # Load the audio file
                    logger.debug(f"Loading audio file: {sound_path}")
                    layer_audio = AudioSegment.from_file(str(sound_path))
                    
                    # Apply volume from the sound and layer
                    sound_volume = first_sound.get('volume', 1.0)
                    layer_volume = layer.get('volume', 1.0)
                    if sound_volume != 1.0 or layer_volume != 1.0:
                        layer_audio = layer_audio.apply_gain(20 * log10(sound_volume * layer_volume))
                    
                    if mixed_audio is None:
                        mixed_audio = layer_audio
                    else:
                        # Overlay this layer with the existing mix
                        mixed_audio = mixed_audio.overlay(layer_audio)
                        
                except Exception as e:
                    logger.error(f"Error loading audio file {sound_path}: {e}")
                    continue
            
            if mixed_audio is None:
                logger.warning("No audio was mixed - no valid layers found")
                return False
                
            # Export the mixed audio to a buffer
            buffer = io.BytesIO()
            mixed_audio.export(
                buffer,
                format='wav',
                parameters=[
                    '-ar', '48000',  # Sample rate: 48kHz
                    '-ac', '2',      # Channels: 2 (stereo)
                    '-f', 's16le'    # Format: 16-bit little-endian PCM
                ]
            )
            buffer.seek(0)
            
            # Queue the mixed audio for playback
            logger.info("Queueing mixed audio for playback")
            success = queue_audio(guild_id, buffer)
            
            if success:
                logger.info("Successfully queued mixed audio")
                # Store the environment state
                self._environments[guild_id] = environment_data
            else:
                logger.error("Failed to queue mixed audio - make sure the bot is connected to a voice channel")
                
            return success
            
        except Exception as e:
            logger.error(f"Error playing environment: {e}", exc_info=True)
            return False
            
    def stop_environment(self, guild_id: int) -> None:
        """Stop playback for a guild's environment.
        
        Args:
            guild_id: The Discord guild ID to stop playback for
        """
        if guild_id in self._environments:
            logger.info(f"Stopping environment playback for guild {guild_id}")
            # TODO: Implement proper stopping of audio playback
            del self._environments[guild_id]
        else:
            logger.debug(f"No active environment found for guild {guild_id}")

# Create a global instance of the mixer
mixer = AudioMixer() 