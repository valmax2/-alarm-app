"""Eccezioni tipizzate del client ComfyUI.

Mai un'eccezione generica indistinta: chi chiama (router, inventory, ...) deve poter
dare un messaggio azionabile invece di "Error" (spec §26), e la UI deve poter distinguere
"offline" da "risposta inattesa" da "timeout".
"""

from __future__ import annotations


class ComfyClientError(Exception):
    """Base per tutti gli errori del client ComfyUI."""


class ComfyUnreachable(ComfyClientError):
    """ComfyUI non raggiungibile (connessione rifiutata, DNS, host spento)."""


class ComfyTimeout(ComfyClientError):
    """La richiesta ha superato il timeout configurato."""


class ComfyHTTPError(ComfyClientError):
    """ComfyUI ha risposto con uno status HTTP di errore."""

    def __init__(self, status_code: int, body: str):
        self.status_code = status_code
        self.body = body
        super().__init__(f"ComfyUI ha risposto {status_code}: {body[:500]}")


class ComfyProtocolError(ComfyClientError):
    """Risposta ricevuta ma non nel formato atteso (parsing fallito)."""
