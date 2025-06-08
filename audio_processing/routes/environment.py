from flask import Blueprint, request, jsonify, current_app
from ..models.mixer import mixer
from ..models.discord.bot import OrpheusBot
import logging

logger = logging.getLogger(__name__)
environment_bp = Blueprint('environment', __name__)

# Get the bot instance
def get_bot() -> OrpheusBot:
    """Get the bot instance from the app context."""
    if not current_app.bot:
        logger.warning("Bot not initialized (likely in reloader process)")
        return None
    return current_app.bot

@environment_bp.route('/environment/state', methods=['POST'])
def update_environment_state():
    """Update the state of an environment and handle audio playback."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        # Try to get guild_id from request, fallback to bot's active guild
        guild_id = data.get('guild_id')
        if not guild_id:
            bot = get_bot()
            if not bot:
                return jsonify({'error': 'Bot not initialized'}), 503
            guild_id = bot.active_guild_id
            if not guild_id:
                return jsonify({'error': 'No guild_id provided and no active guild found'}), 400
            logger.info(f"Using cached guild ID: {guild_id}")
            
        environment_data = data.get('environment')
        if not environment_data:
            return jsonify({'error': 'No environment data provided'}), 400
            
        is_playing = environment_data.get('playState') == 'PLAYING'
        
        if is_playing:
            # Start playback
            success = mixer.play_environment(guild_id, environment_data)
            if success:
                return jsonify({'status': 'playing'}), 200
            else:
                return jsonify({'error': 'Failed to start playback'}), 500
        else:
            # Stop playback
            mixer.stop_environment(guild_id)
            return jsonify({'status': 'stopped'}), 200
            
    except Exception as e:
        logger.error(f"Error updating environment state: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500 