"""Analisi immagine → prompt strutturato (spec §9: "Prompt da Immagine").

Chiamate HTTP REALI verso i provider cloud configurati dall'utente — mai un provider
nostro nascosto, mai una chiave hardcoded (spec §20). Nessun provider è raggiungibile
con una chiave reale in questo ambiente di sviluppo (vedi AUDIT.md): validato con mock
del trasporto HTTP (stesso approccio usato per `comfy_client`), la verifica con una
chiave reale dell'utente resta a suo carico.

Modalità "locale" (VLM installato sul PC dell'utente, §9): prevista nello schema
(`AIProviderRecord.kind == "local"`) ma NON ancora implementata in questa consegna —
dichiarato esplicitamente (`UnsupportedProviderKindError`), mai finta.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

import httpx

_STRUCTURED_FIELDS = (
    "subject", "identity", "hair", "face", "body_clothing", "pose_action",
    "environment", "camera", "light", "style", "details", "final_prompt_en",
)

# Prompt di analisi: chiede esplicitamente di evitare deduzioni sensibili non
# necessarie (spec §9) e di descrivere solo ciò che è visivamente osservabile.
_ANALYSIS_INSTRUCTIONS = (
    "Analyze the image and respond with ONLY a JSON object with these string keys: "
    "subject, identity, hair, face, body_clothing, pose_action, environment, camera, "
    "light, style, details, final_prompt_en (a complete English prompt ready for an "
    "image generation model). Describe only what is visually observable in the image. "
    "Avoid unnecessary sensitive inferences (e.g. age, ethnicity, health, identity of "
    "real people) unless unambiguously visible and relevant for reproducing the image. "
    "No text outside the JSON object."
)

DEFAULT_MODELS = {
    "anthropic": "claude-sonnet-5",
    "openai": "gpt-4o",
}


class VisionAnalysisError(Exception):
    pass


class VisionUnreachable(VisionAnalysisError):
    pass


class VisionTimeout(VisionAnalysisError):
    pass


class VisionHTTPError(VisionAnalysisError):
    def __init__(self, status_code: int, body: str):
        self.status_code = status_code
        self.body = body
        super().__init__(f"Il provider ha risposto {status_code}: {body[:500]}")


class VisionProtocolError(VisionAnalysisError):
    pass


class UnsupportedProviderKindError(VisionAnalysisError):
    pass


@dataclass(frozen=True)
class StructuredPrompt:
    subject: str
    identity: str
    hair: str
    face: str
    body_clothing: str
    pose_action: str
    environment: str
    camera: str
    light: str
    style: str
    details: str
    final_prompt_en: str


def _parse_structured_json(text: str) -> StructuredPrompt:
    # Alcuni modelli avvolgono il JSON in un blocco ```json ... ``` nonostante le
    # istruzioni: tolleriamo questo caso comune invece di fallire rigidamente.
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise VisionProtocolError(f"Risposta del provider non è JSON valido: {exc}") from exc
    if not isinstance(data, dict):
        raise VisionProtocolError("Risposta del provider non è un oggetto JSON")
    missing = [f for f in _STRUCTURED_FIELDS if f not in data]
    if missing:
        raise VisionProtocolError(f"Risposta del provider incompleta, campi mancanti: {', '.join(missing)}")
    return StructuredPrompt(**{f: str(data[f]) for f in _STRUCTURED_FIELDS})


async def _post_json(url: str, headers: dict, json_body: dict, timeout_seconds: float) -> dict:
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(url, headers=headers, json=json_body)
    except httpx.TimeoutException as exc:
        raise VisionTimeout(f"Timeout contattando {url}") from exc
    except httpx.ConnectError as exc:
        raise VisionUnreachable(f"Provider non raggiungibile su {url}") from exc
    except httpx.HTTPError as exc:
        raise VisionUnreachable(f"Errore di connessione verso {url}: {exc}") from exc

    if response.status_code >= 400:
        raise VisionHTTPError(response.status_code, response.text)
    try:
        return response.json()
    except ValueError as exc:
        raise VisionProtocolError(f"Risposta non JSON da {url}") from exc


async def analyze_with_anthropic(
    api_key: str, image_base64: str, media_type: str, model: str, timeout_seconds: float = 30.0,
) -> StructuredPrompt:
    url = "https://api.anthropic.com/v1/messages"
    headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
    body = {
        "model": model,
        "max_tokens": 1024,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_base64}},
                    {"type": "text", "text": _ANALYSIS_INSTRUCTIONS},
                ],
            }
        ],
    }
    data = await _post_json(url, headers, body, timeout_seconds)
    content = data.get("content")
    if not isinstance(content, list) or not content:
        raise VisionProtocolError("Risposta Anthropic senza campo 'content' valido")
    text_parts = [b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"]
    return _parse_structured_json("".join(text_parts))


async def analyze_with_openai(
    api_key: str, image_base64: str, media_type: str, model: str,
    base_url: str | None = None, timeout_seconds: float = 30.0,
) -> StructuredPrompt:
    url = f"{(base_url or 'https://api.openai.com').rstrip('/')}/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    body = {
        "model": model,
        "max_tokens": 1024,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": _ANALYSIS_INSTRUCTIONS},
                    {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{image_base64}"}},
                ],
            }
        ],
    }
    data = await _post_json(url, headers, body, timeout_seconds)
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices:
        raise VisionProtocolError("Risposta OpenAI senza campo 'choices' valido")
    message = choices[0].get("message", {}) if isinstance(choices[0], dict) else {}
    text = message.get("content", "")
    if not isinstance(text, str):
        raise VisionProtocolError("Risposta OpenAI con contenuto non testuale inatteso")
    return _parse_structured_json(text)


async def analyze_image_to_prompt(
    kind: str, api_key: str, image_base64: str, media_type: str,
    base_url: str | None = None, model: str | None = None, timeout_seconds: float = 30.0,
) -> StructuredPrompt:
    if kind == "anthropic":
        return await analyze_with_anthropic(
            api_key, image_base64, media_type, model or DEFAULT_MODELS["anthropic"], timeout_seconds
        )
    if kind == "openai":
        return await analyze_with_openai(
            api_key, image_base64, media_type, model or DEFAULT_MODELS["openai"], base_url, timeout_seconds
        )
    raise UnsupportedProviderKindError(
        f"Provider di tipo '{kind}' non supportato per l'analisi immagine in questa fase "
        "(solo 'anthropic'/'openai'; 'local' non ancora implementato)"
    )
