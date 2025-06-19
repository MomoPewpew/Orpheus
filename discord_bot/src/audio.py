import logging
import discord
from typing import Optional, Dict, Any
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
        self._active = True  # Track if we're actively streaming
        self.done = False  # Track if we're done streaming
        self._started = False  # Track if we've started reading
        logger.info("Initialized PCM stream source")

    def add_audio(self, pcm_data: bytes):
        """Add PCM audio data to the buffer."""
        try:
            if not self._active:
                logger.warning("Trying to add audio to inactive stream")
                return

            # Only add data if we have room
            if len(self.buffer) < self.MAX_BUFFER_SIZE:
                self.buffer.extend(pcm_data)
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
            if not self._active:
                logger.debug("Stream inactive, returning None")
                return None

            if not self._started:
                self._started = True
                logger.info("Starting to read audio data")

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

                return frame
            else:
                if len(self.buffer) > 0:
                    # If we have some data but not enough for a full frame, pad with zeros
                    remaining = bytes(self.buffer)
                    padding = bytes(self.FRAME_LENGTH - len(remaining))
                    self.buffer.clear()
                    logger.debug(f"Padding partial frame with {len(padding)} bytes of silence")
                    return remaining + padding
                elif not self.done and self._started and self._read_count > 0:
                    # Only mark as done if we've actually started reading and have read some frames
                    logger.info(f"Buffer empty after reading {self._read_count} frames, marking stream as done")
                    self.done = True
                return None
        except Exception as e:
            logger.error(f"Error reading frame: {e}")
            return None

    def cleanup(self):
        """Clean up resources."""
        if self._active:  # Only log cleanup once
            logger.info(f"Cleaning up PCM stream source after reading {self._read_count} frames")
            self._active = False
            self.buffer.clear()


class AudioManager:
    """Manages audio playback for a Discord bot."""

    def __init__(self, bot: discord.Client):
        """Initialize the audio manager.
        
        Args:
            bot: The Discord bot instance to manage audio for
        """
        self.bot = bot
        self._audio_streams: Dict[int, Any] = {}
        self._mixer = None  # Reference to the audio mixer for guild ID updates

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

                # Add audio before starting playback
                audio_source.add_audio(pcm_data)

                # Make sure we're not already playing
                if voice_client.is_playing():
                    logger.info("Stopping existing playback")
                    voice_client.stop()

                logger.info("Starting playback with new audio source")
                voice_client.play(audio_source, after=lambda e2: self._on_playback_finished(guild_id, e2))

                # Verify playback started
                if not voice_client.is_playing():
                    logger.error("Failed to start playback")
                    self.cleanup_guild(guild_id)
                    return False
            else:
                # Add to existing stream
                stream_data = self._audio_streams[guild_id]
                stream_data['audio_source'].add_audio(pcm_data)

                # Restart playback if needed
                if not voice_client.is_playing():
                    logger.info("Restarting playback")
                    voice_client.play(stream_data['audio_source'],
                                      after=lambda e3: self._on_playback_finished(guild_id, e3))

            return True

        except Exception as e:
            logger.error(f"Error queueing audio: {e}", exc_info=True)
            return False

    def _on_playback_finished(self, guild_id: int, error: Optional[Exception]) -> None:
        """Handle playback completion or errors.
        
        Args:
            guild_id: The ID of the guild where playback finished
            error: Any error that occurred during playback, or None if successful
        """
        if error:
            logger.error(f"Playback error in guild {guild_id}: {error}")
            self.cleanup_guild(guild_id)
        else:
            logger.info(f"Playback finished in guild {guild_id}")
            # Only cleanup if the stream is done
            if guild_id in self._audio_streams and self._audio_streams[guild_id]['audio_source'].done:
                self.cleanup_guild(guild_id)

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

    def get_buffer_size(self, guild_id: int) -> Optional[int]:
        """Get the number of 20ms chunks currently buffered for a guild.
        
        Args:
            guild_id: The ID of the guild to get buffer size for.
            
        Returns:
            The number of 20ms chunks in the buffer, or None if no stream exists.
        """
        if guild_id not in self._audio_streams:
            return None

        stream_data = self._audio_streams[guild_id]
        if 'audio_source' not in stream_data:
            return None

        audio_source = stream_data['audio_source']
        return len(audio_source.buffer) // audio_source.FRAME_LENGTH


__all__ = ['AudioManager']
