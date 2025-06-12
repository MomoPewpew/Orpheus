import logging
import discord
import io
from typing import Optional, Dict, Any
import numpy as np
import time

logger = logging.getLogger(__name__)

class PCMStreamSource(discord.AudioSource):
    """Custom audio source for streaming PCM data."""
    
    def __init__(self):
        self.buffer = bytearray()
        self.FRAME_LENGTH = 3840  # 20ms of 48kHz stereo audio (48000 * 2 * 2 * 0.02)
        self.MIN_BUFFER_SIZE = self.FRAME_LENGTH * 3  # Keep at least 60ms buffered
        self.MAX_BUFFER_SIZE = self.FRAME_LENGTH * 10  # Don't let buffer grow beyond 200ms
        self._read_count = 0
        self._last_read_time = 0
        logger.info("Initialized PCM stream source")
        
    def add_audio(self, pcm_data: bytes):
        """Add PCM audio data to the buffer."""
        try:
            # Only add data if we have room
            if len(self.buffer) < self.MAX_BUFFER_SIZE:
                self.buffer.extend(pcm_data)
                logger.debug(f"Added {len(pcm_data)} bytes to buffer, total size: {len(self.buffer)}")
            else:
                logger.warning("Buffer full, dropping audio data")
        except Exception as e:
            logger.error(f"Error adding audio data: {e}")
        
    def read(self) -> Optional[bytes]:
        """Read the next frame of audio data.
        
        Returns:
            bytes: 20ms of PCM audio data, or None if not enough data
        """
        try:
            current_time = time.time()
            
            # Check if we have enough data
            if len(self.buffer) >= self.FRAME_LENGTH:
                # If we have more than minimum buffer, we can be strict about timing
                if len(self.buffer) >= self.MIN_BUFFER_SIZE:
                    # Ensure we're not reading too fast
                    time_since_last_read = current_time - self._last_read_time
                    if time_since_last_read < 0.02:  # 20ms frame time
                        time.sleep(0.02 - time_since_last_read)
                
                frame = bytes(self.buffer[:self.FRAME_LENGTH])
                self.buffer = self.buffer[self.FRAME_LENGTH:]
                self._read_count += 1
                self._last_read_time = current_time
                
                if self._read_count % 50 == 0:  # Log every second
                    logger.debug(f"Read frame #{self._read_count}, buffer: {len(self.buffer)/self.FRAME_LENGTH:.1f} frames")
                return frame
            else:
                if len(self.buffer) > 0:
                    logger.debug(f"Buffer low: {len(self.buffer)} bytes ({len(self.buffer)/self.FRAME_LENGTH:.1f} frames)")
                return None
        except Exception as e:
            logger.error(f"Error reading frame: {e}")
            return None
        
    def cleanup(self):
        """Clean up resources."""
        logger.info(f"Cleaning up PCM stream source after reading {self._read_count} frames")
        self.buffer.clear()
        
    def is_opus(self) -> bool:
        """Return False since we're sending raw PCM."""
        return False

class AudioManager:
    """Manages audio playback for a Discord bot."""
    
    def __init__(self, bot: discord.Client):
        """Initialize the audio manager.
        
        Args:
            bot: The Discord bot instance to manage audio for
        """
        self.bot = bot
        self._audio_streams: Dict[int, Any] = {}
        
    def _get_voice_client(self, guild_id: int) -> Optional[discord.VoiceClient]:
        """Get the voice client for a guild.
        
        Args:
            guild_id: The ID of the guild to get the voice client for.
            
        Returns:
            The voice client for the guild, or None if not found.
        """
        if not self.bot:
            logger.error("Bot not initialized")
            return None
            
        for voice_client in self.bot.voice_clients:
            if voice_client.guild.id == guild_id:
                return voice_client
        return None
        
    def queue_audio(self, guild_id: int, pcm_data: bytes) -> bool:
        """Queue PCM audio data for playback in a guild.
        
        Args:
            guild_id: The ID of the guild to queue audio for.
            pcm_data: Raw PCM audio data (48kHz, 16-bit, stereo)
            
        Returns:
            True if the audio was queued successfully, False otherwise.
        """
        try:
            voice_client = self._get_voice_client(guild_id)
            if not voice_client or not voice_client.is_connected():
                logger.warning(f"No active voice client for guild {guild_id}")
                return False

            # Get or create audio source
            if guild_id not in self._audio_streams:
                logger.info(f"Creating new audio stream for guild {guild_id}")
                audio_source = PCMStreamSource()
                self._audio_streams[guild_id] = {
                    'voice_client': voice_client,
                    'audio_source': audio_source
                }
                # Make sure we're not already playing
                if voice_client.is_playing():
                    voice_client.stop()
                voice_client.play(audio_source)
            elif not voice_client.is_playing():
                # If we have a stream but it's not playing, restart it
                logger.info(f"Restarting audio stream for guild {guild_id}")
                stream_data = self._audio_streams[guild_id]
                voice_client.play(stream_data['audio_source'])
            
            # Add audio to the stream
            stream_data = self._audio_streams[guild_id]
            stream_data['audio_source'].add_audio(pcm_data)
            
            return True
            
        except Exception as e:
            logger.error(f"Error queueing audio: {e}")
            return False
            
    def cleanup_guild(self, guild_id: int) -> None:
        """Clean up resources for a guild.
        
        Args:
            guild_id: The ID of the guild to clean up resources for.
        """
        if guild_id in self._audio_streams:
            logger.info(f"Cleaning up audio stream for guild {guild_id}")
            stream_data = self._audio_streams[guild_id]
            voice_client = stream_data['voice_client']
            if voice_client and voice_client.is_playing():
                voice_client.stop()
            if 'audio_source' in stream_data:
                stream_data['audio_source'].cleanup()
            del self._audio_streams[guild_id]
            
    def stop_playback(self, guild_id: int) -> bool:
        """Stop audio playback for a guild.
        
        Args:
            guild_id: The ID of the guild to stop playback for.
            
        Returns:
            True if playback was stopped, False if there was no active playback.
        """
        voice_client = self._get_voice_client(guild_id)
        if voice_client and voice_client.is_playing():
            voice_client.stop()
            self.cleanup_guild(guild_id)
            return True
        return False
        
    @property
    def active_guilds(self) -> list[int]:
        """Get the list of guild IDs with active audio streams."""
        return list(self._audio_streams.keys())
        
    def is_playing(self, guild_id: int) -> bool:
        """Check if audio is currently playing in a guild.
        
        Args:
            guild_id: The ID of the guild to check.
            
        Returns:
            True if audio is playing, False otherwise.
        """
        return guild_id in self._audio_streams and self._audio_streams[guild_id]['voice_client'].is_playing()

__all__ = ['AudioManager'] 