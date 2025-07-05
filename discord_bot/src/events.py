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

        # Only sync commands globally
        try:
            logger.info("Attempting to sync commands globally...")
            await bot.tree.sync()
            global_commands = await bot.tree.fetch_commands()
            logger.info(f"Global commands synced successfully. Available commands: {[cmd.name for cmd in global_commands]}")
        except discord.Forbidden as e:
            logger.error(f"Failed to sync commands globally - Missing Permissions: {e}")
        except Exception as e:
            logger.error(f"Failed to sync commands globally: {e}")

        # Log guild information without syncing
        logger.info(f'Connected to {len(bot.guilds)} guilds:')
        for guild in bot.guilds:
            logger.info(f'- {guild.name} (id: {guild.id})')
            bot_member = guild.get_member(bot.user.id)
            if bot_member:
                logger.info(f'  Bot permissions: {bot_member.guild_permissions}')
                if not bot_member.guild_permissions.use_application_commands:
                    logger.warning(f"  Missing 'use_application_commands' permission in guild {guild.name}")
            else:
                logger.warning(f'  Bot not found in guild {guild.name}')

    @bot.event
    async def on_guild_join(guild):
        logger.info(f'Bot joined new guild: {guild.name} (id: {guild.id})')
        bot_member = guild.get_member(bot.user.id)
        if bot_member:
            logger.info(f'Bot permissions in new guild: {bot_member.guild_permissions}')
            if not bot_member.guild_permissions.use_application_commands:
                logger.warning(f"Missing 'use_application_commands' permission in new guild {guild.name}")

    @bot.event
    async def on_voice_state_update(member, before, after):
        """Handle voice state changes to clean up resources when bot is disconnected."""
        if member.id == bot.user.id and before.channel and not after.channel:
            # Bot was disconnected from a voice channel
            if hasattr(bot, 'audio_manager'):
                logger.info(f"Bot disconnected from voice in {before.channel.guild.name}, cleaning up")
                bot.audio_manager.cleanup_guild(before.channel.guild.id)
