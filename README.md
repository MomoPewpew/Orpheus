# Orpheus

Orpheus is a Discord bot designed to play ambient sounds and layered musical tracks for tabletop roleplay. The bot offers a web-based control panel for directors to manage audio playback and configurations, with support for complex audio environments, soundboards, and real-time audio mixing.

## Components

1. **Discord Bot** (`/discord_bot`)
   - Handles voice channel management and audio streaming
   - Built with discord.py
   - Features:
     - Real-time PCM audio streaming
     - Voice channel management (/join, /leave commands)
     - Audio buffer management for smooth playback

2. **Web Control Panel** (`/frontend`)
   - Main control interface for directors
   - Built with TypeScript, React, and Material-UI
   - Features:
     - Environment management with layered audio
     - Preset system for quick scene switching
     - Global soundboard for instant sound effects
     - Master volume control
     - Real-time audio state management

3. **Audio Processing Backend** (`/audio_processing`)
   - Handles audio mixing, processing, and streaming
   - Built with Python (FastAPI)
   - Features:
     - Real-time audio mixing
     - Environment-level fade transitions
     - Multi-layer audio processing
     - Audio state management and persistence

## Key Features

- **Environment System**: Create and manage multiple audio environments with independent layers
- **Layer Management**: Each environment supports multiple audio layers with individual controls
- **Preset System**: Save and load environment configurations for quick scene changes
- **Soundboard**: Global sound effects accessible across environments
- **Fade Transitions**: Smooth transitions between environments with configurable fade durations
- **Real-time Control**: Immediate response to audio control changes

## Development Setup

### Prerequisites

- Docker and Docker Compose
- Discord Bot Token (for bot functionality)

Note: Local development dependencies (if not using Docker):
- Python 3.10 or higher
- Node.js 18 or higher
- FFmpeg (for audio processing)

### Dependencies

These dependencies are automatically handled by Docker. Listed here for reference:

#### Web Frameworks
- `fastapi==0.104.1`
- `uvicorn==0.24.0`
- `flask==2.3.3`
- `werkzeug==2.3.7`
- `flask-cors==3.0.10`

#### Audio Processing
- `librosa==0.10.1`
- `soundfile==0.12.1`
- `numpy==1.24.3`
- `pydub>=0.25.1`
- `ffmpeg-python>=0.2.0`
- `scipy>=1.11.0`

#### File Handling & Configuration
- `python-multipart==0.0.6`
- `python-dotenv==0.19.0`

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/Orpheus.git
   cd Orpheus
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your Discord bot token and other configurations
   ```

3. Build and start the Docker containers:
   ```bash
   # Build the containers
   docker compose build

   # Start the services
   docker compose up -d

   # View logs (optional)
   docker compose logs -f
   ```

   This will start:
   - Audio processing backend (FastAPI)
   - Frontend development server
   - Discord bot

4. Access the services:
   - Web Control Panel: http://localhost:3000
   - Audio Processing API: http://localhost:8000
   - Discord Bot: Will connect to Discord when properly configured

To stop the services:
```bash
docker compose down
```

## Usage

1. Invite the bot to your Discord server
2. Use `/join` to connect the bot to your voice channel
3. Access the web control panel to manage audio environments
4. Create environments and add audio layers
5. Use the soundboard for instant sound effects
6. Save presets for quick scene switching

## Project Structure

```
Orpheus/
├── discord_bot/        # Discord bot component
│   └── src/
│       ├── audio.py    # Audio streaming and management
│       ├── commands.py # Bot commands
│       └── events.py   # Event handlers
├── frontend/          # Web control panel
│   └── src/
│       ├── components/ # React components
│       ├── services/   # API services
│       └── types/      # TypeScript types
└── audio_processing/  # Audio backend
    ├── models/        # Audio state models
    ├── routes/        # API endpoints
    └── main.py        # Application entry point
```

## License

This project is licensed under the GNU License - see the [LICENSE](LICENSE) file for details.