"""Client HTTP verso ComfyUI.

Fase 1: `get_system_stats` (Bridge-status reale, §3 della spec).
Fase 2: `get_object_info` (schema completo di tutti i nodi registrati — fonte
dell'inventario nodi/modelli, §11 e Fase 2 del piano).
Fase 6: `queue_prompt`, `get_queue`, `get_history`, `interrupt`, `get_view_bytes`
(generazione reale, §18/§26). La relay WebSocket (`/ws?clientId=...`, progress live
per-nodo) resta esplicitamente NON implementata in questa consegna — Fase 6 v1 usa
polling su `/queue`+`/history` invece di un canale realtime persistente, una
semplificazione dichiarata (vedi IMPLEMENTATION_PLAN.md) per consegnare la generazione
reale senza l'infrastruttura aggiuntiva (task in background, riconnessione, multiplexing
verso più client browser) che una relay WS robusta richiederebbe.

Nessun altro modulo deve aprire connessioni dirette a ComfyUI: questo è l'unico punto di
contatto (vedi docs/module-boundaries.md).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import httpx

from bridge.comfy_client.exceptions import (
    ComfyHTTPError,
    ComfyProtocolError,
    ComfyTimeout,
    ComfyUnreachable,
)


@dataclass(frozen=True)
class ComfySystemStats:
    """Vista normalizzata (e tollerante) della risposta di /system_stats.

    Ogni campo è opzionale: se ComfyUI non lo espone (versione diversa, campo mancante),
    resta `None` piuttosto che sollevare un errore di parsing — coerente con
    "nessuna assunzione di versione" in docs/comfyui-api.md.
    """

    version: str | None
    os: str | None
    python_version: str | None
    pytorch_version: str | None
    raw: dict


@dataclass(frozen=True)
class QueuePromptResult:
    prompt_id: str
    number: int | None
    node_errors: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class QueueState:
    """Vista normalizzata di GET /queue: gli id dei prompt in coda, running o pending
    (§18) — usata dal polling per distinguere "in coda" da "in esecuzione"."""

    running_prompt_ids: list[str]
    pending_prompt_ids: list[str]


@dataclass(frozen=True)
class ComfyUploadResult:
    """Vista normalizzata della risposta di `POST /upload/image` — il `name` che
    ComfyUI assegna davvero può differire dal filename originale (rinominato per
    evitare collisioni nella sua cartella `input/`), quindi è questo valore, non
    quello locale, che va scritto nel widget `image` del nodo target."""

    name: str
    subfolder: str
    type: str


class ComfyClient:
    def __init__(self, base_url: str, timeout_seconds: float = 5.0):
        self._base_url = base_url.rstrip("/")
        self._timeout_seconds = timeout_seconds

    async def _get_json(self, path: str, timeout_seconds: float | None = None) -> Any:
        """GET generico con la gestione errori condivisa da tutte le chiamate.

        Solleva `ComfyUnreachable`, `ComfyTimeout`, `ComfyHTTPError` o
        `ComfyProtocolError` — mai un'eccezione generica (spec §26, §34).
        """
        url = f"{self._base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=timeout_seconds or self._timeout_seconds) as client:
                response = await client.get(url)
        except httpx.TimeoutException as exc:
            raise ComfyTimeout(f"Timeout contattando {url}") from exc
        except httpx.ConnectError as exc:
            raise ComfyUnreachable(f"ComfyUI non raggiungibile su {url}") from exc
        except httpx.HTTPError as exc:
            # Errori di trasporto non altrimenti classificati: trattati come
            # irraggiungibile, mai propagati come eccezione generica al chiamante.
            raise ComfyUnreachable(f"Errore di connessione verso {url}: {exc}") from exc

        if response.status_code >= 400:
            raise ComfyHTTPError(response.status_code, response.text)

        try:
            return response.json()
        except ValueError as exc:
            raise ComfyProtocolError(f"Risposta non JSON da {url}") from exc

    async def _post_json(
        self, path: str, body: dict[str, Any], timeout_seconds: float | None = None
    ) -> Any:
        """POST generico — stessa gestione errori tipizzata di `_get_json` (spec §26,
        §34: mai un'eccezione generica)."""
        url = f"{self._base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=timeout_seconds or self._timeout_seconds) as client:
                response = await client.post(url, json=body)
        except httpx.TimeoutException as exc:
            raise ComfyTimeout(f"Timeout contattando {url}") from exc
        except httpx.ConnectError as exc:
            raise ComfyUnreachable(f"ComfyUI non raggiungibile su {url}") from exc
        except httpx.HTTPError as exc:
            raise ComfyUnreachable(f"Errore di connessione verso {url}: {exc}") from exc

        if response.status_code >= 400:
            raise ComfyHTTPError(response.status_code, response.text)

        try:
            return response.json()
        except ValueError as exc:
            raise ComfyProtocolError(f"Risposta non JSON da {url}") from exc

    async def get_system_stats(self) -> ComfySystemStats:
        """Chiama GET /system_stats."""
        data = await self._get_json("/system_stats")
        if not isinstance(data, dict):
            raise ComfyProtocolError("Risposta JSON inattesa da /system_stats: non è un oggetto")

        system = data.get("system") if isinstance(data.get("system"), dict) else {}
        return ComfySystemStats(
            version=system.get("comfyui_version"),
            os=system.get("os"),
            python_version=system.get("python_version"),
            pytorch_version=system.get("pytorch_version"),
            raw=data,
        )

    async def get_object_info(self) -> dict[str, dict]:
        """Chiama GET /object_info: schema completo di TUTTI i nodi registrati
        (core + custom node installati), fonte primaria dell'Inventory Engine
        (docs/comfyui-api.md). Ritorna il dict grezzo {class_type: schema} così com'è
        — la normalizzazione (input_summary/output_summary, widget hint) è
        responsabilità di `bridge.inventory` (docs/module-boundaries.md), non del
        client di trasporto.
        """
        data = await self._get_json("/object_info", timeout_seconds=self._object_info_timeout())
        if not isinstance(data, dict):
            raise ComfyProtocolError("Risposta JSON inattesa da /object_info: non è un oggetto")
        return data

    def _object_info_timeout(self) -> float:
        # /object_info può essere pesante con molti custom node installati: un timeout
        # più lungo del default usato per /system_stats (docs/comfyui-api.md).
        return max(self._timeout_seconds, 20.0)

    async def queue_prompt(self, prompt: dict[str, Any], client_id: str) -> QueuePromptResult:
        """Chiama POST /prompt (spec §18/§26): invia un job compilato
        (`bridge.workflow.compile_to_comfy_payload`) alla coda di ComfyUI.
        `node_errors` non vuoto indica errori di validazione LATO COMFYUI (es. un
        valore widget fuori range) — riportati così come sono, mai interpretati o
        nascosti (il Bridge valida la struttura prima, ma solo ComfyUI conosce i
        vincoli fini di ogni nodo)."""
        data = await self._post_json("/prompt", {"prompt": prompt, "client_id": client_id})
        if not isinstance(data, dict) or "prompt_id" not in data:
            raise ComfyProtocolError("Risposta inattesa da POST /prompt: manca 'prompt_id'")
        node_errors = data.get("node_errors")
        return QueuePromptResult(
            prompt_id=str(data["prompt_id"]),
            number=data.get("number"),
            node_errors=node_errors if isinstance(node_errors, dict) else {},
        )

    async def get_queue(self) -> QueueState:
        """Chiama GET /queue: usato dal polling (Fase 6 v1, nessuna relay WS in
        questa consegna) per sapere se un prompt è ancora in coda o già in
        esecuzione, prima che compaia in /history."""
        data = await self._get_json("/queue")
        if not isinstance(data, dict):
            raise ComfyProtocolError("Risposta JSON inattesa da /queue: non è un oggetto")

        def _ids(section: Any) -> list[str]:
            if not isinstance(section, list):
                return []
            ids = []
            for entry in section:
                # formato osservato: [number, prompt_id, prompt, extra_data, outputs_to_execute]
                if isinstance(entry, list) and len(entry) > 1:
                    ids.append(str(entry[1]))
            return ids

        return QueueState(
            running_prompt_ids=_ids(data.get("queue_running")),
            pending_prompt_ids=_ids(data.get("queue_pending")),
        )

    async def get_history(self, prompt_id: str) -> dict | None:
        """Chiama GET /history/{prompt_id}. Ritorna `None` (non un'eccezione) se il
        job non è ancora nello storico — stato normale mentre è in coda/esecuzione,
        non un errore da propagare."""
        data = await self._get_json(f"/history/{prompt_id}")
        if not isinstance(data, dict) or prompt_id not in data:
            return None
        entry = data[prompt_id]
        return entry if isinstance(entry, dict) else None

    async def interrupt(self, prompt_id: str | None = None) -> None:
        """Chiama POST /interrupt (ABORT, spec §18). Tenta prima la forma con
        `prompt_id` (targeting più preciso, supportata da alcune versioni), e se
        ComfyUI risponde errore ripiega sulla forma senza payload — tollerante, non
        un'assunzione silenziosa di compatibilità (docs/comfyui-api.md)."""
        if prompt_id is not None:
            try:
                await self._post_json("/interrupt", {"prompt_id": prompt_id})
                return
            except ComfyHTTPError:
                pass  # ripiego sotto: alcune versioni non supportano il targeting
        await self._post_json("/interrupt", {})

    async def get_view_bytes(self, filename: str, subfolder: str, file_type: str) -> bytes:
        """Chiama GET /view: scarica i byte grezzi di un output (immagine/video)."""
        url = f"{self._base_url}/view"
        params = {"filename": filename, "subfolder": subfolder, "type": file_type}
        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.get(url, params=params)
        except httpx.TimeoutException as exc:
            raise ComfyTimeout(f"Timeout contattando {url}") from exc
        except httpx.ConnectError as exc:
            raise ComfyUnreachable(f"ComfyUI non raggiungibile su {url}") from exc
        except httpx.HTTPError as exc:
            raise ComfyUnreachable(f"Errore di connessione verso {url}: {exc}") from exc

        if response.status_code >= 400:
            raise ComfyHTTPError(response.status_code, response.text)
        return response.content

    async def upload_image(self, filename: str, content: bytes, content_type: str) -> ComfyUploadResult:
        """Chiama `POST /upload/image`: carica un'immagine nella cartella `input/` di
        ComfyUI, così un nodo `LoadImage` (o equivalente) possa referenziarla per nome
        — passo necessario per "Invia immagine personaggio al workflow" (Fase 7), dato
        che ComfyUI legge le immagini di input dal proprio filesystem, mai da un path
        arbitrario del Bridge."""
        url = f"{self._base_url}/upload/image"
        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.post(url, files={"image": (filename, content, content_type)})
        except httpx.TimeoutException as exc:
            raise ComfyTimeout(f"Timeout contattando {url}") from exc
        except httpx.ConnectError as exc:
            raise ComfyUnreachable(f"ComfyUI non raggiungibile su {url}") from exc
        except httpx.HTTPError as exc:
            raise ComfyUnreachable(f"Errore di connessione verso {url}: {exc}") from exc

        if response.status_code >= 400:
            raise ComfyHTTPError(response.status_code, response.text)
        try:
            body = response.json()
        except ValueError as exc:
            raise ComfyProtocolError(f"Risposta non JSON da {url}") from exc

        name = body.get("name")
        if not isinstance(name, str) or not name:
            raise ComfyProtocolError(f"Risposta di {url} senza un campo 'name' valido: {body!r}")
        return ComfyUploadResult(
            name=name,
            subfolder=body.get("subfolder") or "",
            type=body.get("type") or "input",
        )
