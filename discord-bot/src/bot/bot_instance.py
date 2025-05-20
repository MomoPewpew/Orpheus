"""
Global access point for the Discord bot instance and its audio streams.
This module provides a centralized way to interact with the bot from anywhere in the application.
"""

import logging
from typing import Optional, Dict
from discord import VoiceClient
from ..audio.stream import AudioStream

logger = logging.getLogger(__name__)

# Global bot instance
_bot = None
_audio_streams: Dict[int, AudioStream] = {}

def init(bot_instance) -> None:
    """Initialize the global bot instance."""
    global _bot, _audio_streams
    _bot = bot_instance
    _audio_streams = {}
    logger.info("Bot instance initialized")

def get_bot():
    """Get the global bot instance."""
    if _bot is None:
        raise RuntimeError("Bot instance not initialized")
    return _bot

def get_audio_stream(guild_id: int) -> Optional[AudioStream]:
    """Get the audio stream for a specific guild."""
    return _audio_streams.get(guild_id)

async def queue_audio(guild_id: int, audio_data, *, ensure_connected: bool = True) -> bool:
    """
    Queue audio data for a specific guild.
    
    Args:
        guild_id: The Discord guild ID
        audio_data: Audio data to queue (bytes or file-like object)
        ensure_connected: If True, verify bot is in a voice channel
        
    Returns:
        bool: True if audio was queued successfully
        
    Raises:
        RuntimeError: If bot is not initialized
        ValueError: If guild not found or bot is not in a voice channel (when ensure_connected=True)
    """
    if _bot is None:
        raise RuntimeError("Bot instance not initialized")
        
    guild = _bot.get_guild(guild_id)
    if not guild:
        raise ValueError(f"Guild {guild_id} not found")
        
    # Get or verify voice client
    voice_client = guild.voice_client
    if ensure_connected and (not voice_client or not voice_client.is_connected()):
        raise ValueError(f"Bot is not connected to a voice channel in guild {guild.name}")
    
    # Get or create audio stream
    if guild_id not in _audio_streams:
        if not voice_client:
            return False
        logger.info(f"Creating new AudioStream for guild {guild.name}")
        _audio_streams[guild_id] = AudioStream(voice_client)
    
    audio_stream = _audio_streams[guild_id]
    
    # Queue the audio
    success = await audio_stream.queue_audio(audio_data)
    if success:
        logger.info(f"Audio queued successfully for guild {guild.name}")
    else:
        logger.error(f"Failed to queue audio for guild {guild.name}")
    
    return success

def cleanup_guild(guild_id: int) -> None:
    """Remove audio stream for a specific guild."""
    if guild_id in _audio_streams:
        del _audio_streams[guild_id]
        logger.info(f"Cleaned up AudioStream for guild {guild_id}") 