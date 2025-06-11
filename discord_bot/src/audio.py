import logging
import discord
import io
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

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
        
    def queue_audio(self, guild_id: int, audio_data: io.BytesIO) -> bool:
        """Queue audio data for playback in a guild.
        
        Args:
            guild_id: The ID of the guild to queue audio for.
            audio_data: The audio data to queue.
            
        Returns:
            True if the audio was queued successfully, False otherwise.
        """
        try:
            voice_client = self._get_voice_client(guild_id)
            if not voice_client or not voice_client.is_connected():
                logger.warning(f"No active voice client for guild {guild_id}")
                return False
                
            voice_client.play(discord.FFmpegPCMAudio(audio_data, pipe=True))
            self._audio_streams[guild_id] = {
                'voice_client': voice_client,
                'is_playing': True
            }
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
        return guild_id in self._audio_streams and self._audio_streams[guild_id]['is_playing']

__all__ = ['AudioManager'] 