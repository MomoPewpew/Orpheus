import asyncio
import logging
from typing import Optional, Dict, Union
from discord import VoiceClient, VoiceChannel, PCMAudio
from io import IOBase
import io

logger = logging.getLogger(__name__)

class AudioStream:
    """
    Handles streaming audio through Discord voice channels.
    Uses a queue system to buffer audio data and stream it continuously.
    """
    def __init__(self, voice_client: Optional[VoiceClient] = None):
        self._voice_client = voice_client
        self._audio_queue: Optional[asyncio.Queue] = asyncio.Queue() if voice_client else None
        self._stream_task: Optional[asyncio.Task] = None
        self._is_streaming: bool = False
        self._should_stop: bool = False
        
        # If we're initialized with a voice client, start streaming
        if voice_client:
            self._start_streaming()
    
    def _start_streaming(self):
        """Start the streaming task if it's not already running."""
        if not self._stream_task or self._stream_task.done():
            self._should_stop = False
            self._is_streaming = True
            self._stream_task = asyncio.create_task(self._stream_audio())
            logger.info("Started new streaming task")
        
    @property
    def is_connected(self) -> bool:
        """Check if we're connected to a voice channel."""
        return self._voice_client is not None and self._voice_client.is_connected()
        
    @property
    def is_streaming(self) -> bool:
        """Check if we're currently streaming audio."""
        return self._is_streaming and not self._should_stop and (self._stream_task is not None and not self._stream_task.done())

    async def set_voice_client(self, voice_client: VoiceClient) -> None:
        """Set the voice client and initialize streaming if not already started."""
        logger.debug("Setting new voice client")
        
        # Stop any existing streaming gracefully
        if self._stream_task and not self._stream_task.done():
            logger.debug("Stopping existing streaming task")
            self._should_stop = True
            await self._wait_for_stop()
            
        # Set new voice client
        self._voice_client = voice_client
        
        # Initialize queue if needed
        if not self._audio_queue:
            self._audio_queue = asyncio.Queue()
            
        # Start new streaming task
        logger.debug("Starting new streaming task")
        self._start_streaming()
        
        # Wait a short time to ensure the task started successfully
        await asyncio.sleep(0.1)
        if not self.is_streaming:
            logger.error("Failed to start streaming task")
            raise RuntimeError("Failed to start streaming task")

    async def _wait_for_stop(self, timeout: float = 5.0):
        """Wait for the current streaming task to stop gracefully."""
        try:
            if self._stream_task:
                await asyncio.wait_for(self._stream_task, timeout=timeout)
        except asyncio.TimeoutError:
            logger.warning("Streaming task did not stop gracefully, forcing stop")
            if self._stream_task:
                self._stream_task.cancel()
                try:
                    await self._stream_task
                except asyncio.CancelledError:
                    pass
        finally:
            self._stream_task = None

    async def disconnect(self):
        """
        Disconnect from voice channel and cleanup resources.
        """
        try:
            # Stop streaming gracefully
            self._should_stop = True
            await self._wait_for_stop()
            
            # Disconnect voice client
            if self._voice_client:
                await self._voice_client.disconnect()
                self._voice_client = None
            
            # Clear queue
            if self._audio_queue:
                while not self._audio_queue.empty():
                    try:
                        self._audio_queue.get_nowait()
                    except asyncio.QueueEmpty:
                        break
                self._audio_queue = None
                
            logger.info("Disconnected from voice channel")
            
        except Exception as e:
            logger.error(f"Error during disconnect: {e}")

    async def queue_audio(self, audio_data: Union[bytes, IOBase]) -> bool:
        """
        Add audio data to the streaming queue.
        Accepts either bytes or a file-like object.
        Returns False if not connected or streaming has stopped.
        """
        if not self.is_connected:
            logger.warning("Cannot queue audio: not connected")
            return False
            
        if not self._audio_queue:
            logger.warning("Cannot queue audio: no audio queue")
            return False

        # Ensure streaming is active
        if not self.is_streaming:
            logger.info("Restarting streaming task")
            self._start_streaming()

        try:
            await self._audio_queue.put(audio_data)
            logger.debug("Audio data queued successfully")
            return True
        except Exception as e:
            logger.error(f"Error queueing audio: {e}")
            return False

    async def _stream_audio(self):
        """
        Main streaming loop that processes audio data from the queue.
        """
        try:
            while self.is_connected and not self._should_stop:
                if not self._audio_queue:
                    logger.error("Audio queue is None")
                    break
                    
                try:
                    # Get the next chunk of audio data
                    audio_data = await self._audio_queue.get()
                    logger.debug(f"Got audio data from queue: {type(audio_data)}")
                    
                    # Stop any currently playing audio
                    if self._voice_client.is_playing():
                        self._voice_client.stop()
                    
                    try:
                        # Create and play the audio source
                        if isinstance(audio_data, IOBase):
                            audio_source = PCMAudio(audio_data)
                        else:
                            # If it's bytes, wrap it in a BytesIO
                            buffer = io.BytesIO(audio_data)
                            audio_source = PCMAudio(buffer)
                            
                        logger.debug("Created PCMAudio source")
                        
                        self._voice_client.play(
                            audio_source,
                            after=lambda e: logger.error(f"Error in playback callback: {e}") if e else None
                        )
                        logger.debug("Started audio playback")
                        
                        # Wait for the audio to finish playing
                        while self._voice_client.is_playing():
                            if self._should_stop:
                                self._voice_client.stop()
                                break
                            await asyncio.sleep(0.1)
                            
                    except Exception as e:
                        logger.error(f"Error playing audio: {str(e)}", exc_info=True)
                        
                except asyncio.CancelledError:
                    logger.info("Streaming task cancelled")
                    break
                except asyncio.QueueEmpty:
                    # No more audio to play, but keep the task running
                    await asyncio.sleep(0.1)
                except Exception as e:
                    logger.error(f"Error in audio streaming loop: {str(e)}", exc_info=True)
                    await asyncio.sleep(1)  # Prevent tight loop on errors
                    
        except Exception as e:
            logger.error(f"Fatal error in streaming task: {str(e)}", exc_info=True)
        finally:
            self._is_streaming = False
            logger.info("Streaming task ended") 