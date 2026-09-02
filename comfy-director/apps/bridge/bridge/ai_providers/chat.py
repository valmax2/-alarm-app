"""Chat testuale con l'Assistente AI (Fase 10 v1, spec §21).

Chiamate HTTP REALI verso i provider cloud configurati dall'utente (stessa astrazione
`AIProvider`/cifratura della Fase 9, riusata qui come previsto da
docs/module-boundaries.md: "possono condividere la stessa astrazione AIProvider sotto
il cofano"). Nessun provider nostro nascosto, nessuna chiave hardcoded.

Questa è SOLO conversazione testuale: l'AI Tool Layer completo (§21 — `add_node`,
`connect_nodes`, `set_node_parameter`, preview/applica/annulla su una proposta prima di
mutare il workflow davvero) NON è implementato in questa consegna. Aggiungerlo ora,
senza un meccanismo di preview/conferma reale, violerebbe la regola "mai modifiche non
validate" (spec §22) — dichiarato esplicitamente, mai finto.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import httpx

ChatRole = Literal["user", "assistant"]

DEFAULT_MODELS = {
    "anthropic": "claude-sonnet-5",
    "openai": "gpt-4o",
}

_SYSTEM_PROMPT = (
    "Sei l'assistente AI di Comfy Director, un livello di gestione intelligente sopra "
    "ComfyUI locale. Rispondi in italiano, in modo conciso e pratico. In questa fase "
    "NON puoi ancora modificare il workflow dell'utente direttamente (nessun tool per "
    "aggiungere/collegare nodi è ancora disponibile) — se l'utente chiede di farlo, "
    "spiega che questa funzione arriverà in un aggiornamento futuro, e nel frattempo "
    "offri consigli testuali su come farlo lui stesso nella canvas."
)


class ChatError(Exception):
    pass


class ChatUnreachable(ChatError):
    pass


class ChatTimeout(ChatError):
    pass


class ChatHTTPError(ChatError):
    def __init__(self, status_code: int, body: str):
        self.status_code = status_code
        self.body = body
        super().__init__(f"Il provider ha risposto {status_code}: {body[:500]}")


class ChatProtocolError(ChatError):
    pass


class UnsupportedProviderKindError(ChatError):
    pass


@dataclass(frozen=True)
class ChatMessageIn:
    role: ChatRole
    text: str


async def _post_json(url: str, headers: dict, json_body: dict, timeout_seconds: float) -> dict:
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(url, headers=headers, json=json_body)
    except httpx.TimeoutException as exc:
        raise ChatTimeout(f"Timeout contattando {url}") from exc
    except httpx.ConnectError as exc:
        raise ChatUnreachable(f"Provider non raggiungibile su {url}") from exc
    except httpx.HTTPError as exc:
        raise ChatUnreachable(f"Errore di connessione verso {url}: {exc}") from exc

    if response.status_code >= 400:
        raise ChatHTTPError(response.status_code, response.text)
    try:
        return response.json()
    except ValueError as exc:
        raise ChatProtocolError(f"Risposta non JSON da {url}") from exc


async def _chat_with_anthropic(
    api_key: str, history: list[ChatMessageIn], model: str, timeout_seconds: float,
) -> str:
    url = "https://api.anthropic.com/v1/messages"
    headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
    body = {
        "model": model,
        "max_tokens": 1024,
        "system": _SYSTEM_PROMPT,
        "messages": [{"role": m.role, "content": m.text} for m in history],
    }
    data = await _post_json(url, headers, body, timeout_seconds)
    content = data.get("content")
    if not isinstance(content, list) or not content:
        raise ChatProtocolError("Risposta Anthropic senza campo 'content' valido")
    text_parts = [b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"]
    reply = "".join(text_parts)
    if not reply:
        raise ChatProtocolError("Risposta Anthropic senza testo")
    return reply


async def _chat_with_openai(
    api_key: str, history: list[ChatMessageIn], model: str, base_url: str | None, timeout_seconds: float,
) -> str:
    url = f"{(base_url or 'https://api.openai.com').rstrip('/')}/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    body = {
        "model": model,
        "max_tokens": 1024,
        "messages": [{"role": "system", "content": _SYSTEM_PROMPT}] + [
            {"role": m.role, "content": m.text} for m in history
        ],
    }
    data = await _post_json(url, headers, body, timeout_seconds)
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices:
        raise ChatProtocolError("Risposta OpenAI senza campo 'choices' valido")
    message = choices[0].get("message", {}) if isinstance(choices[0], dict) else {}
    text = message.get("content")
    if not isinstance(text, str) or not text:
        raise ChatProtocolError("Risposta OpenAI senza testo")
    return text


async def send_chat_message(
    kind: str, api_key: str, history: list[ChatMessageIn],
    base_url: str | None = None, model: str | None = None, timeout_seconds: float = 30.0,
) -> str:
    """`history` include già il nuovo messaggio dell'utente come ultimo elemento —
    restituisce SOLO il testo della risposta dell'assistente (la persistenza dei due
    messaggi è responsabilità del router, non di questo modulo di trasporto)."""
    if kind == "anthropic":
        return await _chat_with_anthropic(api_key, history, model or DEFAULT_MODELS["anthropic"], timeout_seconds)
    if kind == "openai":
        return await _chat_with_openai(api_key, history, model or DEFAULT_MODELS["openai"], base_url, timeout_seconds)
    raise UnsupportedProviderKindError(
        f"Provider di tipo '{kind}' non supportato per la chat in questa fase (solo 'anthropic'/'openai'; "
        "'local' non ancora implementato)"
    )
