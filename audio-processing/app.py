from flask import Flask
from flask_cors import CORS
from routes.workspace import workspace_bp
from routes.files import files_bp
import os
import logging

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Register blueprints
logger.info("Registering workspace blueprint with /api prefix")
app.register_blueprint(workspace_bp, url_prefix='/api')
logger.info("Registering files blueprint with /api prefix")
app.register_blueprint(files_bp, url_prefix='/api')

@app.route('/health')
def health_check():
    """Health check endpoint"""
    return {'status': 'ok'}

if __name__ == '__main__':
    # Get host and port from environment or use defaults
    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    logger.info(f"Starting Flask server on {host}:{port} (debug={debug})")
    logger.info(f"Registered routes: {[str(rule) for rule in app.url_map.iter_rules()]}")
    
    app.run(host=host, port=port, debug=debug) 