"""Discord-specific implementations for the bot manager."""

from .bot import create_bot, OrpheusBot
from .audio import queue_audio, cleanup_guild
from .commands import register_commands
from .events import register_events

__all__ = [
    'create_bot',
    'OrpheusBot',
    'queue_audio',
    'cleanup_guild',
    'register_commands',
    'register_events'
] 