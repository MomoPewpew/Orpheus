import logging
import discord
import io
from typing import Optional, Dict, Any
from flask import current_app

logger = logging.getLogger(__name__)

# Global audio stream storage
_audio_streams: Dict[int, Any] = {}

def cleanup_guild(guild_id: int) -> None:
    """Clean up resources for a guild.
    
    Args:
        guild_id: The ID of the guild to clean up resources for.
    """
    if guild_id in _audio_streams:
        logger.info(f"Cleaning up audio stream for guild {guild_id}")
        del _audio_streams[guild_id]

def _get_voice_client(guild_id: int) -> Optional[discord.VoiceClient]:
    """Get the voice client for a guild.
    
    Args:
        guild_id: The ID of the guild to get the voice client for.
        
    Returns:
        The voice client for the guild, or None if not found.
    """
    if not current_app or not current_app.bot_manager:
        logger.error("Bot manager not initialized")
        return None
        
    bot = current_app.bot_manager.bot
    if not bot:
        logger.error("Bot not initialized")
        return None
        
    for voice_client in bot.voice_clients:
        if voice_client.guild.id == guild_id:
            return voice_client
    return None

def queue_audio(guild_id: int, audio_data: io.BytesIO) -> bool:
    """Queue audio data for playback in a guild.
    
    Args:
        guild_id: The ID of the guild to queue audio for.
        audio_data: The audio data to queue.
        
    Returns:
        True if the audio was queued successfully, False otherwise.
    """
    try:
        voice_client = _get_voice_client(guild_id)
        if not voice_client or not voice_client.is_connected():
            logger.warning(f"No active voice client for guild {guild_id}")
            return False
            
        voice_client.play(discord.FFmpegPCMAudio(audio_data, pipe=True))
        # Store the audio stream for this guild
        _audio_streams[guild_id] = {
            'voice_client': voice_client,
            'is_playing': True
        }
        return True
    except Exception as e:
        logger.error(f"Error queueing audio: {e}")
        return False

__all__ = ['queue_audio', 'cleanup_guild', '_audio_streams'] 