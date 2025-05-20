import os
import logging
import discord
from discord import app_commands
from dotenv import load_dotenv
from pathlib import Path
from ..audio.stream import AudioStream
import io
from gtts import gTTS
from pydub import AudioSegment
from . import bot_instance

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
logger.info("Starting environment variable loading process...")

# Try loading from workspace root first
workspace_root = Path(__file__).parent.parent.parent.parent
env_path = workspace_root / '.env'
logger.info(f"Looking for .env file at: {env_path}")

if env_path.exists():
    logger.info(f".env file found at {env_path}")
    load_dotenv(env_path)
else:
    logger.info("No .env file found in workspace root, trying current directory")
    load_dotenv()

# Log environment variable status
token = os.getenv('DISCORD_TOKEN')
logger.info(f"DISCORD_TOKEN present: {token is not None}")
if token is None:
    logger.error("DISCORD_TOKEN is missing from environment")
    logger.info("Available environment variables:")
    for key in os.environ:
        if 'TOKEN' in key or 'SECRET' in key:
            logger.info(f"{key}: [hidden]")
        else:
            logger.info(f"{key}: {os.environ[key]}")
    raise ValueError("No DISCORD_TOKEN found in environment variables")

# Bot setup with all required intents
logger.info("Setting up bot intents...")
intents = discord.Intents.default()
intents.message_content = True
intents.voice_states = True
intents.members = True
intents.presences = True
intents.guilds = True

logger.info("Creating bot instance...")
class OrpheusBot(discord.Client):
    def __init__(self):
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)
        
    async def setup_hook(self):
        logger.info("Setting up command tree...")
        # Get the development guild ID from environment
        dev_guild_id = os.getenv('DISCORD_GUILD_ID')
        if dev_guild_id:
            try:
                dev_guild = discord.Object(id=int(dev_guild_id))
                logger.info(f"Syncing commands with development guild: {dev_guild_id}")
                # Copy global commands to guild and sync
                self.tree.copy_global_to(guild=dev_guild)
                await self.tree.sync(guild=dev_guild)
                # List commands after sync
                commands = await self.tree.fetch_commands(guild=dev_guild)
                logger.info(f"Available commands: {[cmd.name for cmd in commands]}")
                logger.info("Initial sync complete")
            except Exception as e:
                logger.error(f"Error during initial sync: {e}")
        else:
            logger.warning("No DISCORD_GUILD_ID found, syncing globally (this may take up to an hour)")
            await self.tree.sync()
        logger.info("Command tree synced")

bot = OrpheusBot()
bot_instance.init(bot)  # Initialize the global bot instance

@bot.event
async def on_ready():
    logger.info(f'{bot.user} has connected to Discord!')
    logger.info(f'Bot ID: {bot.user.id}')
    logger.info(f'Bot Name: {bot.user.name}')
    logger.info(f'Bot Discriminator: {bot.user.discriminator}')
    
    # List all guilds and their permissions
    logger.info(f'Connected to {len(bot.guilds)} guilds:')
    for guild in bot.guilds:
        logger.info(f'- {guild.name} (id: {guild.id})')
        # Get bot's permissions in this guild
        bot_member = guild.get_member(bot.user.id)
        if bot_member:
            logger.info(f'  Bot permissions: {bot_member.guild_permissions}')
            # Try to sync commands for each guild
            try:
                await bot.tree.sync(guild=guild)
                logger.info(f"  Commands synced for guild {guild.name}")
                # List all commands
                commands = await bot.tree.fetch_commands(guild=guild)
                logger.info(f"  Available commands: {[cmd.name for cmd in commands]}")
            except Exception as e:
                logger.error(f"  Error syncing commands for guild {guild.name}: {e}")
        else:
            logger.warning(f'  Bot not found in guild {guild.name}')

@bot.event
async def on_guild_join(guild):
    logger.info(f'Bot joined new guild: {guild.name} (id: {guild.id})')
    bot_member = guild.get_member(bot.user.id)
    if bot_member:
        logger.info(f'Bot permissions in new guild: {bot_member.guild_permissions}')
    # Sync commands with the new guild
    await bot.tree.sync(guild=guild)

@bot.event
async def on_voice_state_update(member, before, after):
    """Handle voice state changes to cleanup resources when bot is disconnected."""
    if member.id == bot.user.id and before.channel and not after.channel:
        # Bot was disconnected from a voice channel
        if before.channel.guild.id in bot_instance._audio_streams:
            logger.info(f"Bot disconnected from voice in {before.channel.guild.name}, cleaning up")
            bot_instance.cleanup_guild(before.channel.guild.id)

@bot.tree.command(name="join", description="Join your voice channel")
async def join(interaction: discord.Interaction):
    """Join the voice channel you're currently in."""
    logger.info(f"Join command received from {interaction.user} in {interaction.guild.name}")
    
    # Check if user is in a voice channel
    if not interaction.user.voice:
        logger.warning(f"User {interaction.user} is not in a voice channel")
        await interaction.response.send_message("You need to be in a voice channel to use this command.", ephemeral=True)
        return

    # Get the voice channel
    channel = interaction.user.voice.channel
    
    try:
        logger.info(f"Joining channel {channel.name}")
        await channel.connect()
        await interaction.response.send_message(f"Joined {channel.name}", ephemeral=True)
    except Exception as e:
        logger.error(f"Error joining channel: {e}")
        await interaction.response.send_message("Failed to join the voice channel. Please try again.", ephemeral=True)

@bot.tree.command(name="leave", description="Leave the current voice channel")
async def leave(interaction: discord.Interaction):
    """Leave the current voice channel."""
    logger.info(f"Leave command received from {interaction.user} in {interaction.guild.name}")
    
    # Check if bot is in a voice channel
    if not interaction.guild.voice_client:
        logger.warning("Bot is not in a voice channel")
        await interaction.response.send_message("I'm not in a voice channel.", ephemeral=True)
        return

    try:
        logger.info("Leaving voice channel")
        await interaction.guild.voice_client.disconnect()
        await interaction.response.send_message("Left the voice channel", ephemeral=True)
    except Exception as e:
        logger.error(f"Error leaving channel: {e}")
        await interaction.response.send_message("Failed to leave the voice channel. Please try again.", ephemeral=True)

@bot.tree.command(name="test", description="Test audio streaming with TTS")
async def test(interaction: discord.Interaction):
    """Test the audio streaming system with a TTS message."""
    logger.info(f"Test command received from {interaction.user} in {interaction.guild.name}")
    
    # Acknowledge the interaction immediately
    await interaction.response.defer(ephemeral=True)
    
    # Check if bot is in a voice channel
    voice_client = interaction.guild.voice_client
    if not voice_client or not voice_client.is_connected():
        logger.warning("Bot is not in a voice channel or connection is not ready")
        await interaction.followup.send("I need to be in a voice channel first. Use /join to add me!", ephemeral=True)
        return

    try:
        # Create TTS audio
        await interaction.followup.send("Generating audio...", ephemeral=True)
        logger.info("Generating TTS audio")
        tts = gTTS("Testing audio streaming. If you can hear this, it's working!", lang='en')
        mp3_buffer = io.BytesIO()
        tts.write_to_fp(mp3_buffer)
        mp3_buffer.seek(0)
        
        # Convert MP3 to PCM using pydub
        logger.info("Converting audio to PCM format")
        audio = AudioSegment.from_mp3(mp3_buffer)
        
        # Export as WAV (PCM) format with correct parameters for Discord
        logger.info("Exporting as PCM")
        pcm_buffer = io.BytesIO()
        audio.export(pcm_buffer, format='wav', parameters=[
            '-ar', '48000',  # Sample rate: 48kHz
            '-ac', '2',      # Channels: 2 (stereo)
            '-f', 's16le'    # Format: 16-bit little-endian PCM
        ])
        pcm_buffer.seek(0)
        
        # Queue the audio
        logger.info("Queueing audio data")
        success = await bot_instance.queue_audio(interaction.guild_id, pcm_buffer)
        
        if success:
            logger.info("Audio queued successfully")
            await interaction.followup.send("Test audio queued! You should hear it soon.", ephemeral=True)
        else:
            logger.error("Failed to queue audio")
            await interaction.followup.send("Failed to queue test audio. Please try using /join again.", ephemeral=True)
            
    except ValueError as e:
        logger.error(f"Value error in test command: {e}")
        await interaction.followup.send(str(e), ephemeral=True)
    except Exception as e:
        logger.error(f"Error in test command: {e}", exc_info=True)
        await interaction.followup.send("An error occurred while testing audio.", ephemeral=True)

def main():
    """Run the bot."""
    logger.info("Starting bot...")
    token = os.getenv('DISCORD_TOKEN')
    if not token:
        logger.error("No DISCORD_TOKEN found in environment variables")
        raise ValueError("No DISCORD_TOKEN found in environment variables")
    
    logger.info("Running bot...")
    bot.run(token)

if __name__ == "__main__":
    main() 