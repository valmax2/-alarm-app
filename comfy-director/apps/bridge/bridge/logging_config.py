"""Logging strutturato con redazione dei segreti.

Regola non negoziabile (spec §20, §29): le API key/credenziali non devono MAI finire nei
log. Questo modulo applica una redazione a livello di formatter, così che anche un
`logger.info(f"provider config: {cfg}")` accidentale non esponga una chiave — è una rete
di sicurezza, non una scusa per loggare segreti di proposito altrove nel codice.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

_SECRET_KEY_PATTERN = re.compile(
    r"(?i)(api[_-]?key|authorization|secret|token|password)\s*[:=]\s*([^\s,;'\"]+)"
)


def redact(text: str) -> str:
    return _SECRET_KEY_PATTERN.sub(lambda m: f"{m.group(1)}=***REDACTED***", text)


class RedactingJsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        message = redact(record.getMessage())
        payload = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": message,
        }
        if record.exc_info:
            payload["exception"] = redact(self.formatException(record.exc_info))
        extra = getattr(record, "context", None)
        if extra:
            payload["context"] = json.loads(redact(json.dumps(extra, default=str)))
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level: str, log_dir: Path | None = None) -> None:
    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()

    formatter = RedactingJsonFormatter()

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    root.addHandler(stream_handler)

    if log_dir is not None:
        log_dir.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_dir / "bridge.log", encoding="utf-8")
        file_handler.setFormatter(formatter)
        root.addHandler(file_handler)
