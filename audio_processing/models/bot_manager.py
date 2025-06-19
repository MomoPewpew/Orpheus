import os
import logging
import asyncio
from dotenv import load_dotenv
from pathlib import Path
from typing import Optional
from abc import ABC, abstractmethod
from discord_bot.src import create_bot, OrpheusBot
from discord_bot.src.audio import AudioManager
from io import BytesIO
from flask import current_app

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

    @abstractmethod
    def queue_audio(self, audio_data: BytesIO) -> bool:
        """Queue audio to the bot."""
        pass

    @abstractmethod
    def has_voice_activity(self, guild_id: Optional[int] = None) -> bool:
        """Check if any users (except the bot) are speaking in the voice channel.
        
        Args:
            guild_id: Optional guild ID to check. If not provided, will try to get from current_app
            
        Returns:
            bool: True if any non-bot users are speaking, False otherwise
        """
        pass

    @abstractmethod
    def is_voice_connected(self, guild_id: int) -> bool:
        """Check if the bot has an active voice connection for the given guild.
        
        Args:
            guild_id: The guild ID to check
            
        Returns:
            bool: True if there is an active voice connection, False otherwise
        """
        pass


class DiscordBotManager(BotManager):
    """Discord-specific implementation of BotManager."""

    _instance = None

    def __new__(cls, bot: Optional[OrpheusBot] = None):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, bot: Optional[OrpheusBot] = None):
        if getattr(self, '_initialized', False):
            return

        self._initialized = True
        self.bot = bot
        self.audio_manager = None
        self._guild_id = None  # Store guild ID in the manager
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

        # Create bot instance only if not provided
        if self.bot is None:
            logger.info("No bot instance provided, creating new one")
            self.bot = create_bot()
            
        # Store reference to this manager in the bot
        self.bot._bot_manager = self
        logger.info("Bot manager reference stored in bot instance")

        # Initialize audio manager
        self.audio_manager = AudioManager(self.bot)
        logger.info("Audio manager initialized")

    def start_bot(self) -> None:
        """Start the Discord bot"""
        if not self.bot:
            raise RuntimeError("Bot not initialized")

        token = os.getenv('DISCORD_TOKEN')
        if not token:
            raise ValueError("No DISCORD_TOKEN found in environment variables")

        # Create an event loop for the bot
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            # Run the bot
            self.bot.run(token)
        finally:
            loop.close()

    def stop_bot(self) -> None:
        """Stop the Discord bot"""
        if self.bot:
            self.bot.close()

    def is_ready(self) -> bool:
        """Check if the Discord bot is ready and connected"""
        return bool(self.bot and self.bot.is_ready())

    def has_voice_activity(self, guild_id: Optional[int] = None) -> bool:
        """Check if any users (except the bot) are speaking in the voice channel."""
        if not self.bot or not self.audio_manager:
            return False

        return True

    def queue_audio(self, audio_data: BytesIO) -> bool:
        """Queue audio to the Discord bot"""
        if not self._guild_id:
            logger.error("Cannot queue audio - guild ID not set in bot manager")
            return False

        if self.audio_manager:
            return self.audio_manager.queue_audio(self._guild_id, audio_data)
        return False

    def is_voice_connected(self, guild_id: int) -> bool:
        """Check if the bot has an active voice connection for the given guild."""
        if not self.bot or not self.audio_manager:
            return False

        # Check if we have a voice client for this guild
        return bool(self.bot.get_guild(guild_id) and self.bot.get_guild(guild_id).voice_client)

    def set_guild_id(self, guild_id: int) -> None:
        """Set the guild ID in the bot manager and related components.
        
        Args:
            guild_id: The Discord guild ID to set
        """
        # Store guild ID in manager
        self._guild_id = guild_id
        logger.info(f"Set guild ID {guild_id} in bot manager")
        
        # Set guild ID in bot
        if self.bot:
            self.bot.set_active_guild(guild_id)
        
        # Set guild ID in mixer
        if self.audio_manager and hasattr(self.audio_manager, '_mixer'):
            self.audio_manager._mixer._guild_id = guild_id
            logger.info(f"Set guild ID {guild_id} in mixer")

    def get_guild_id(self) -> Optional[int]:
        """Get the current guild ID.
        
        Returns:
            The current guild ID, or None if not set
        """
        return self._guild_id
