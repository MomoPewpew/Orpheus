import discord
from discord import app_commands
import logging
from typing import Optional
import os

logger = logging.getLogger(__name__)

class OrpheusBot(discord.Client):
    """Discord bot implementation for Orpheus."""
    
    def __init__(self, intents: discord.Intents):
        """Initialize the bot with the given intents."""
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)
        
    async def setup_hook(self):
        """Set up the bot's commands and sync them."""
        from .commands import register_commands
        from .events import register_events
        
        # Register commands and events
        register_commands(self)
        register_events(self)
        logger.info("Registered Discord commands and events")
        
        # Sync commands
        dev_guild_id = os.getenv('DISCORD_GUILD_ID')
        if dev_guild_id:
            try:
                dev_guild = discord.Object(id=int(dev_guild_id))
                self.tree.copy_global_to(guild=dev_guild)
                await self.tree.sync(guild=dev_guild)
                logger.info(f"Synced commands with development guild: {dev_guild_id}")
            except Exception as e:
                logger.error(f"Error during initial sync: {e}")
        else:
            await self.tree.sync()
            logger.info("Synced commands globally")

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