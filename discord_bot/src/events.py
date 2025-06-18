import logging
import discord

logger = logging.getLogger(__name__)


def register_events(bot: discord.Client) -> None:
    """Register all event handlers for the Discord bot.
    
    Args:
        bot: The Discord bot instance to register events for.
    """

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
        """Handle voice state changes to clean up resources when bot is disconnected."""
        if member.id == bot.user.id and before.channel and not after.channel:
            # Bot was disconnected from a voice channel
            if hasattr(bot, 'audio_manager'):
                logger.info(f"Bot disconnected from voice in {before.channel.guild.name}, cleaning up")
                bot.audio_manager.cleanup_guild(before.channel.guild.id)
