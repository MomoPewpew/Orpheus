import os
import logging
import discord
from discord import app_commands
from dotenv import load_dotenv
from pathlib import Path
from typing import Optional, Any
from abc import ABC, abstractmethod

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class BotManager(ABC):
    """Abstract base class for bot managers.
    
    This class defines the interface that all bot managers must implement,
    regardless of the platform (Discord, Twitch, etc.).
    """
    
    @abstractmethod
    def get_bot(self) -> Any:
        """Get the bot instance."""
        pass
        
    @abstractmethod
    def start_bot(self) -> None:
        """Start the bot."""
        pass
        
    @abstractmethod
    def stop_bot(self) -> None:
        """Stop the bot."""
        pass
        
    @abstractmethod
    def is_ready(self) -> bool:
        """Check if the bot is ready and connected."""
        pass
        
    @abstractmethod
    def _setup_bot(self) -> None:
        """Initialize the bot with required configuration."""
        pass

class DiscordBotManager(BotManager):
    """Discord-specific implementation of BotManager."""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if getattr(self, '_initialized', False):
            return
            
        self._initialized = True
        self.bot = None
        self._setup_bot()
        
    def _setup_bot(self) -> None:
        """Initialize the Discord bot with all required intents"""
        # Load environment variables
        workspace_root = Path(__file__).parent.parent.parent
        env_path = workspace_root / '.env'
        
        if env_path.exists():
            load_dotenv(env_path)
        else:
            load_dotenv()
            
        # Verify token exists
        token = os.getenv('DISCORD_TOKEN')
        if token is None:
            raise ValueError("No DISCORD_TOKEN found in environment variables")
            
        # Set up intents
        intents = discord.Intents.default()
        intents.message_content = True
        intents.voice_states = True
        intents.members = True
        intents.presences = True
        intents.guilds = True
        
        # Create bot instance
        class OrpheusBot(discord.Client):
            def __init__(self):
                super().__init__(intents=intents)
                self.tree = app_commands.CommandTree(self)
                
            async def setup_hook(self):
                dev_guild_id = os.getenv('DISCORD_GUILD_ID')
                if dev_guild_id:
                    try:
                        dev_guild = discord.Object(id=int(dev_guild_id))
                        self.tree.copy_global_to(guild=dev_guild)
                        await self.tree.sync(guild=dev_guild)
                    except Exception as e:
                        logger.error(f"Error during initial sync: {e}")
                else:
                    await self.tree.sync()
                    
        self.bot = OrpheusBot()
        
        # Set up basic event handlers
        @self.bot.event
        async def on_ready():
            logger.info(f'{self.bot.user} has connected to Discord!')
            
    def get_bot(self) -> Optional[discord.Client]:
        """Get the Discord bot instance"""
        return self.bot
        
    def start_bot(self) -> None:
        """Start the Discord bot"""
        if not self.bot:
            raise RuntimeError("Bot not initialized")
            
        token = os.getenv('DISCORD_TOKEN')
        if not token:
            raise ValueError("No DISCORD_TOKEN found in environment variables")
            
        self.bot.run(token)
        
    def stop_bot(self) -> None:
        """Stop the Discord bot"""
        if self.bot:
            self.bot.close()
            
    def is_ready(self) -> bool:
        """Check if the Discord bot is ready and connected"""
        return bool(self.bot and self.bot.is_ready()) 