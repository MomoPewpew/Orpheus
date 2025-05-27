"""Discord bot initialization module."""

import logging
from audio_processing.models.discord import create_bot

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create and expose the bot instance
bot = create_bot()

def main():
    """Run the bot."""
    logger.info("Starting bot...")
    bot.run()

if __name__ == "__main__":
    main() 