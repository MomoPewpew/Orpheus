import os
import logging
import discord
from discord import app_commands
from dotenv import load_dotenv
from pathlib import Path

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
        await interaction.response.send_message(f"Joined {channel.name}")
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
        await interaction.response.send_message("Left the voice channel")
    except Exception as e:
        logger.error(f"Error leaving channel: {e}")
        await interaction.response.send_message("Failed to leave the voice channel. Please try again.", ephemeral=True)

@bot.tree.command(name="sync", description="Sync slash commands to the current guild")
@app_commands.default_permissions(administrator=True)
async def sync(interaction: discord.Interaction):
    """Sync slash commands to the current guild. Admin only."""
    logger.info(f"Sync command received from {interaction.user} in {interaction.guild.name}")
    
    try:
        # Respond immediately
        await interaction.response.defer(ephemeral=True)
        
        logger.info(f"Syncing commands to guild {interaction.guild.id}")
        # Copy global commands to guild and sync
        bot.tree.copy_global_to(guild=interaction.guild)
        await bot.tree.sync(guild=interaction.guild)
        
        # List all commands after sync
        commands = await bot.tree.fetch_commands(guild=interaction.guild)
        command_list = [f"{cmd.name} - {cmd.description}" for cmd in commands]
        logger.info(f"Available commands after sync: {command_list}")
        
        if command_list:
            # Format commands nicely
            command_text = "\n".join(f"• {cmd}" for cmd in command_list)
            await interaction.followup.send(
                f"Commands synced to this server! Available commands:\n{command_text}",
                ephemeral=True
            )
        else:
            await interaction.followup.send(
                "No commands available. This might be a bug - please try restarting the bot.",
                ephemeral=True
            )
    except Exception as e:
        logger.error(f"Error syncing commands: {e}")
        try:
            await interaction.followup.send(
                "Failed to sync commands. Please try again or restart the bot.",
                ephemeral=True
            )
        except:
            logger.error("Failed to send error message")

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