from flask import Flask
from flask_cors import CORS
from audio_processing.routes.workspace import workspace_bp, ensure_workspace_dir
from audio_processing.routes.files import files_bp
from audio_processing.routes.environment import environment_bp
from audio_processing.models.bot_manager import BotManager, DiscordBotManager
from .models.discord.bot import create_bot, OrpheusBot
import os
import logging
import threading
import sys

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
    app = Flask(__name__)
    CORS(app)  # Enable CORS for all routes
    
    # Only initialize the bot in the main process
    if is_main_process():
        logger.info("Initializing bot in main process")
        # Initialize the Discord bot manager with a new bot instance
        bot_manager: BotManager = DiscordBotManager()
        app.bot_manager = bot_manager
        app.bot = bot_manager.get_bot()  # Get the bot instance from the manager

        # Start the bot in a separate thread
        def start_bot():
            try:
                bot_manager.start_bot()
            except Exception as e:
                logger.error(f"Failed to start Discord bot: {e}")

        bot_thread = threading.Thread(target=start_bot, daemon=True)
        bot_thread.start()
    else:
        logger.info("Skipping bot initialization in reloader process")
        app.bot_manager = None
        app.bot = None

    # Reset play state on server startup
    ensure_workspace_dir()

    # Register blueprints
    logger.info("Registering workspace blueprint with /api prefix")
    app.register_blueprint(workspace_bp, url_prefix='/api')
    logger.info("Registering files blueprint with /api prefix")
    app.register_blueprint(files_bp, url_prefix='/api')
    logger.info("Registering environment blueprint with /api prefix")
    app.register_blueprint(environment_bp, url_prefix='/api')
    
    @app.route('/health')
    def health_check():
        """Health check endpoint"""
        if app.bot_manager:
            bot_status = "ok" if app.bot_manager.is_ready() else "not_ready"
        else:
            bot_status = "disabled"
        return {
            'status': 'ok',
            'bot_status': bot_status
        }
    
    return app

if __name__ == '__main__':
    # Get host and port from environment or use defaults
    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    app = create_app()
    logger.info(f"Starting Flask server on {host}:{port} (debug={debug})")
    logger.info(f"Registered routes: {[str(rule) for rule in app.url_map.iter_rules()]}")
    
    app.run(host=host, port=port, debug=debug) 