import discord
from discord import app_commands
import logging
from typing import Optional
import os
from .audio import AudioManager
from .commands import register_commands
from .events import register_events

logger = logging.getLogger(__name__)

class OrpheusBot(discord.Client):
    """Discord bot implementation for Orpheus."""
    
    def __init__(self, intents: discord.Intents):
        """Initialize the bot with the given intents."""
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)
        self.last_used_guild_id: Optional[int] = None  # Store the last guild ID where join was used
        self.audio_manager = None
        
    @property
    def active_guild_id(self) -> Optional[int]:
        """Get the ID of the last guild where the bot was used, or None if not available."""
        return self.last_used_guild_id
        
    def set_active_guild(self, guild_id: int) -> None:
        """Set the active guild ID."""
        self.last_used_guild_id = guild_id
        logger.info(f"Set active guild ID to {guild_id}")
        
    async def setup_hook(self):
        """Called when the bot is setting up."""
        # Initialize the audio manager
        self.audio_manager = AudioManager(self)
        # Register commands and events
        register_commands(self)
        register_events(self)
        logger.info("Registered Discord commands and events")

def create_bot() -> OrpheusBot:
    """Create and configure a new bot instance."""
    # Set up intents
    intents = discord.Intents.default()
    intents.message_content = True
    intents.voice_states = True
    intents.members = True
    intents.presences = True
    intents.guilds = True
    
    # Create bot instance
    return OrpheusBot(intents=intents) 