"""Central logging setup for Orpheus."""

from __future__ import annotations

import logging
from datetime import date
from pathlib import Path

LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
LOG_DIR = Path(__file__).parent / 'data' / 'logs'


class DailyErrorFileHandler(logging.FileHandler):
    """Append ERROR+ records to error-YYYY-MM-DD.log, rolling at midnight."""

    def __init__(self, directory: Path):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.current_date = date.today()
        super().__init__(self._path_for(self.current_date), mode='a', encoding='utf-8')

    def _path_for(self, day: date) -> Path:
        return self.directory / f'error-{day.isoformat()}.log'

    def emit(self, record: logging.LogRecord) -> None:
        today = date.today()
        if today != self.current_date:
            self.acquire()
            try:
                if today != self.current_date:
                    if self.stream:
                        self.stream.close()
                        self.stream = None
                    self.baseFilename = str(self._path_for(today))
                    self.stream = self._open()
                    self.current_date = today
            finally:
                self.release()
        super().emit(record)


def configure_logging() -> Path:
    """Configure console logging and a daily append-only error log file.

    Returns the path of today's error log file.
    """
    root = logging.getLogger()
    root.setLevel(logging.DEBUG)

    formatter = logging.Formatter(LOG_FORMAT)

    # Console handler (keep existing stream handlers from basicConfig if present)
    if not any(
        isinstance(h, logging.StreamHandler) and not isinstance(h, logging.FileHandler)
        for h in root.handlers
    ):
        console = logging.StreamHandler()
        console.setLevel(logging.DEBUG)
        console.setFormatter(formatter)
        root.addHandler(console)

    # Daily error file — only attach once
    for handler in root.handlers:
        if getattr(handler, '_orpheus_daily_error', False):
            return Path(handler.baseFilename)

    error_handler = DailyErrorFileHandler(LOG_DIR)
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(formatter)
    error_handler._orpheus_daily_error = True  # type: ignore[attr-defined]
    root.addHandler(error_handler)

    return Path(error_handler.baseFilename)
