import logging
import discord
import io
from gtts import gTTS
from pydub import AudioSegment
import asyncio

logger = logging.getLogger(__name__)


def register_commands(bot: discord.Client) -> None:
    """Register all Discord slash commands.
    
    Args:
        bot: The Discord bot instance to register commands for.
    """

    @bot.tree.command(name="join", description="Join your voice channel")
    async def join(interaction: discord.Interaction):
        """Join the voice channel you're currently in."""
        try:
            # Send immediate response instead of deferring
            await interaction.response.send_message("Connecting to voice channel...", ephemeral=True)

            logger.info(f"Join command received from {interaction.user} in {interaction.guild.name}")

            # Check if user is in a voice channel
            if not interaction.user.voice:
                logger.warning(f"User {interaction.user} is not in a voice channel")
                await interaction.edit_original_response(
                    content="You need to be in a voice channel to use this command.")
                return

            # Get the voice channel
            channel = interaction.user.voice.channel

            # Check if we're already in this voice channel
            if interaction.guild.voice_client and interaction.guild.voice_client.channel == channel:
                logger.info(f"Already in channel {channel.name}")
                await interaction.edit_original_response(content=f"Already in {channel.name}")
                return

            # If we're in a different channel, disconnect first
            if interaction.guild.voice_client:
                logger.info("Disconnecting from current channel before joining new one")
                await interaction.guild.voice_client.disconnect()

            try:
                logger.info(f"Joining channel {channel.name}")
                # Set a reasonable timeout for the connection attempt
                try:
                    await asyncio.wait_for(channel.connect(), timeout=10.0)
                    # Set the guild ID using the bot manager
                    if hasattr(bot, '_bot_manager'):
                        bot._bot_manager.set_guild_id(interaction.guild_id)
                    else:
                        # Fallback to just setting it in the bot
                        bot.set_active_guild(interaction.guild_id)
                        logger.warning("Bot manager not available, guild ID only set in bot")
                    await interaction.edit_original_response(content=f"Joined {channel.name}")
                except asyncio.TimeoutError:
                    logger.error("Timed out while trying to join voice channel")
                    await interaction.edit_original_response(
                        content="Connection timed out. Please try again or check if the bot has proper permissions.")
                except Exception as e:
                    logger.error(f"Error joining channel: {e}")
                    await interaction.edit_original_response(
                        content="Failed to join the voice channel. Please check if the bot has proper permissions.")
            except Exception as e:
                logger.error(f"Unexpected error in join command: {e}")
                await interaction.edit_original_response(
                    content="An unexpected error occurred. Please try again later.")
        except Exception as e:
            logger.error(f"Failed to handle join command: {e}")
            # If we failed to send the initial response, try to respond with an error
            try:
                if not interaction.response.isdone():
                    await interaction.response.send_message("Failed to process command. Please try again.",
                                                            ephemeral=True)
            except:
                pass  # If this fails too, we can't do much more

    @bot.tree.command(name="leave", description="Leave the current voice channel")
    async def leave(interaction: discord.Interaction):
        """Leave the current voice channel."""
        logger.info(f"Leave command received from {interaction.user} in {interaction.guild.name}")

        # Defer the response immediately
        await interaction.response.defer(ephemeral=True)

        # Check if bot is in a voice channel
        if not interaction.guild.voice_client:
            logger.warning("Bot is not in a voice channel")
            await interaction.followup.send("I'm not in a voice channel.", ephemeral=True)
            return

        try:
            logger.info("Leaving voice channel")
            await interaction.guild.voice_client.disconnect()
            await interaction.followup.send("Left the voice channel", ephemeral=True)
        except Exception as e:
            logger.error(f"Error leaving channel: {e}")
            await interaction.followup.send("Failed to leave the voice channel. Please try again.", ephemeral=True)

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
            await interaction.followup.send("I need to be in a voice channel first. Use /join to add me!",
                                            ephemeral=True)
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

            # Convert to proper format for Discord
            logger.info("Converting to Discord format (48kHz, 16-bit stereo PCM)")
            audio = audio.set_frame_rate(48000)
            audio = audio.set_channels(2)
            audio = audio.set_sample_width(2)  # 16-bit

            # Get raw PCM data
            pcm_data = audio.raw_data
            logger.info(f"Generated {len(pcm_data)} bytes of PCM data")

            # Queue the audio using the bot's audio manager
            logger.info("Queueing audio data")
            if hasattr(bot, 'audio_manager'):
                success = bot.audio_manager.queue_audio(interaction.guild_id, pcm_data)

                if success:
                    logger.info("Audio queued successfully")
                    await interaction.followup.send("Test audio queued! You should hear a voice message soon.",
                                                    ephemeral=True)
                else:
                    logger.error("Failed to queue audio")
                    await interaction.followup.send("Failed to queue test audio. Please try using /join again.",
                                                    ephemeral=True)
            else:
                logger.error("Bot does not have an audio manager")
                await interaction.followup.send("Audio system not properly initialized.", ephemeral=True)

        except Exception as e:
            logger.error(f"Error in test command: {e}", exc_info=True)
            await interaction.followup.send("An error occurred while testing audio.", ephemeral=True)
