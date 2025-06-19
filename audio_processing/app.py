from flask import Flask
from flask_cors import CORS
from audio_processing.routes.workspace import workspace_bp, ensure_workspace_dir, load_workspace
from audio_processing.routes.files import files_bp
from audio_processing.models.bot_manager import BotManager, DiscordBotManager
from audio_processing.models.mixer import mixer
import os
import logging
import threading

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def is_main_process():
    """Check if this is the main Flask process (not the reloader)."""
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        return True
    if not os.environ.get('FLASK_ENV') == 'development':
        return True
    return False


def create_app() -> Flask:
    """Create and configure the Flask application."""
    application = Flask(__name__)
    CORS(application)  # Enable CORS for all routes

    # Initialize guild_id as None - will be set when bot joins a channel
    application.guild_id = None

    # Only initialize the bot in the main process
    if is_main_process():
        logger.info("Initializing bot in main process")
        # Initialize the Discord bot manager with a new bot instance
        bot_manager: BotManager = DiscordBotManager()
        application.bot_manager = bot_manager

        # Set the bot manager in the mixer
        mixer.set_bot_manager(bot_manager)
        # Store reference to mixer in bot manager's audio manager for guild ID updates
        if hasattr(bot_manager, 'audio_manager'):
            bot_manager.audio_manager._mixer = mixer

        # Start the bot in a separate thread
        def start_bot():
            try:
                bot_manager.start_bot()
            except Exception as e2:
                logger.error(f"Failed to start Discord bot: {e2}")

        bot_thread = threading.Thread(target=start_bot, daemon=True)
        bot_thread.start()
    else:
        logger.info("Skipping bot initialization in reloader process")
        application.bot_manager = None

    # Reset play state on server startup
    ensure_workspace_dir()

    # Pre-load workspace
    logger.info("Pre-loading workspace...")
    try:
        application.workspace = load_workspace()
        logger.info(
            f"Workspace pre-loaded with {len(application.workspace.environments)}" +
            " environments and {len(application.workspace.sound_files)} sound files")
    except Exception as e:
        logger.error(f"Error pre-loading workspace: {e}", exc_info=True)
        application.workspace = None

    # Register blueprints
    logger.info("Registering workspace blueprint with /api prefix")
    application.register_blueprint(workspace_bp, url_prefix='/api')
    logger.info("Registering files blueprint with /api prefix")
    application.register_blueprint(files_bp, url_prefix='/api')
    logger.info("Registering environment blueprint with /api prefix")

    @application.route('/health')
    def health_check():
        """Health check endpoint"""
        if application.bot_manager:
            bot_status = "ok" if application.bot_manager.is_ready() else "not_ready"
        else:
            bot_status = "disabled"
        return {
            'status': 'ok',
            'bot_status': bot_status
        }

    return application


if __name__ == '__main__':
    # Get host and port from environment or use defaults
    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'

    app = create_app()
    logger.info(f"Starting Flask server on {host}:{port} (debug={debug})")
    logger.info(f"Registered routes: {[str(rule) for rule in app.url_map.iter_rules()]}")

    app.run(host=host, port=port, debug=debug)
