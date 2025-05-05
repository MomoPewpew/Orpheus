import os
import logging
import discord
from discord.ext import commands
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
bot = commands.Bot(command_prefix='!', intents=intents)

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
        else:
            logger.warning(f'  Bot not found in guild {guild.name}')

@bot.event
async def on_guild_join(guild):
    logger.info(f'Bot joined new guild: {guild.name} (id: {guild.id})')
    bot_member = guild.get_member(bot.user.id)
    if bot_member:
        logger.info(f'Bot permissions in new guild: {bot_member.guild_permissions}')

@bot.command(name='join')
async def join(ctx):
    """Joins the voice channel the user is in."""
    logger.info(f"Join command received from {ctx.author} in {ctx.guild.name}")
    if ctx.author.voice is None:
        logger.warning(f"User {ctx.author} is not in a voice channel")
        await ctx.send("You need to be in a voice channel to use this command.")
        return

    channel = ctx.author.voice.channel
    logger.info(f"Joining channel {channel.name}")
    await channel.connect()
    await ctx.send(f"Joined {channel.name}")

@bot.command(name='leave')
async def leave(ctx):
    """Leaves the current voice channel."""
    logger.info(f"Leave command received from {ctx.author} in {ctx.guild.name}")
    if ctx.voice_client is None:
        logger.warning("Bot is not in a voice channel")
        await ctx.send("I'm not in a voice channel.")
        return

    logger.info("Leaving voice channel")
    await ctx.voice_client.disconnect()
    await ctx.send("Left the voice channel")

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