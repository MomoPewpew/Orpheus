from flask import Flask
from flask_cors import CORS
from audio_processing.routes.workspace import workspace_bp, ensure_workspace_dir
from audio_processing.routes.files import files_bp
from audio_processing.models.bot_manager import BotManager, DiscordBotManager
import os
import logging
import threading

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize the Discord bot manager
bot_manager: BotManager = DiscordBotManager()

# Start the bot in a separate thread
def start_bot():
    try:
        bot_manager.start_bot()
    except Exception as e:
        logger.error(f"Failed to start Discord bot: {e}")

bot_thread = threading.Thread(target=start_bot, daemon=True)
bot_thread.start()

# Reset play state on server startup
ensure_workspace_dir()

# Register blueprints
logger.info("Registering workspace blueprint with /api prefix")
app.register_blueprint(workspace_bp, url_prefix='/api')
logger.info("Registering files blueprint with /api prefix")
app.register_blueprint(files_bp, url_prefix='/api')

@app.route('/health')
def health_check():
    """Health check endpoint"""
    bot_status = "ok" if bot_manager.is_ready() else "not_ready"
    return {
        'status': 'ok',
        'bot_status': bot_status
    }

if __name__ == '__main__':
    # Get host and port from environment or use defaults
    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    logger.info(f"Starting Flask server on {host}:{port} (debug={debug})")
    logger.info(f"Registered routes: {[str(rule) for rule in app.url_map.iter_rules()]}")
    
    app.run(host=host, port=port, debug=debug) 