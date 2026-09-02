"""Generazione reale attraverso ComfyUI (Fase 6, spec §18/§26).

Nessuna relay WebSocket in questa consegna (dichiarato esplicitamente in
`comfy_client/client.py` e in IMPLEMENTATION_PLAN.md): lo stato di una generazione è
aggiornato "a richiesta" — ogni `GET /generations/{id}` interroga live `/queue` e
`/history` su ComfyUI e persiste quello che trova, invece di un canale push. Il
frontend fa polling mentre una generazione non è in stato terminale. Semplificazione
dichiarata, non un finto progresso: se nessuno chiede lo stato, semplicemente non si
aggiorna finché non richiesto — mai un numero/percentuale inventata nel frattempo.
"""

from __future__ import annotations

import json
import logging
import mimetypes
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bridge.comfy_client import (
    ComfyClient,
    ComfyHTTPError,
    ComfyProtocolError,
    ComfyTimeout,
    ComfyUnreachable,
)
from bridge.config import Settings
from bridge.deps import get_db_session, get_settings
from bridge.inventory.sync import DEFAULT_INSTANCE_ID
from bridge.models import (
    ComfyInstanceRecord,
    GenerationRecord,
    NodeRecord,
    NodeSchemaRecord,
    WorkflowRecord,
    WorkflowVersionRecord,
)
from bridge.schemas import GenerationOut, GenerationOutputOut
from bridge.workflow import (
    CompileError,
    NodeSchemaInfo,
    WorkflowGraph,
    compile_to_comfy_payload,
    validate_structure,
)

router = APIRouter(tags=["generation"])
logger = logging.getLogger(__name__)


async def _known_node_schemas(session: AsyncSession) -> dict[str, NodeSchemaInfo]:
    """Duplicato deliberatamente da `routers/workflows.py` (stessa query, stesso
    scopo) — la stessa scelta di non condividerla via un modulo comune è già stata
    fatta lì; vedi quel file per la nota."""
    stmt = (
        select(NodeRecord.class_type, NodeSchemaRecord.input_summary, NodeSchemaRecord.output_summary)
        .join(NodeSchemaRecord, NodeSchemaRecord.node_id == NodeRecord.id)
        .where(NodeRecord.comfy_instance_id == DEFAULT_INSTANCE_ID)
    )
    rows = (await session.execute(stmt)).all()
    return {
        class_type: NodeSchemaInfo(input_summary=json.loads(input_json), output_summary=json.loads(output_json))
        for class_type, input_json, output_json in rows
    }


def _aware_utc(dt: datetime | None) -> datetime | None:
    """SQLite non conserva il fuso orario attraverso un giro di scrittura/lettura
    anche su una colonna `DateTime(timezone=True)` (limite noto del dialetto SQLite di
    SQLAlchemy: rilegge un datetime "naive"). Tutti i timestamp scritti da questo
    modulo sono comunque sempre in UTC (`datetime.now(UTC)`) — qui lo rendiamo
    esplicito su un valore riletto dal DB, così i confronti/sottrazioni con un
    `datetime.now(UTC)` fresco non falliscono mai con TypeError, e la risposta API
    resta sempre aware."""
    if dt is None or dt.tzinfo is not None:
        return dt
    return dt.replace(tzinfo=UTC)


def _client_for(instance: ComfyInstanceRecord, settings: Settings) -> ComfyClient:
    return ComfyClient(instance.base_url, timeout_seconds=max(settings.comfy_request_timeout_seconds, 10.0))


def _extract_outputs(history_entry: dict[str, Any]) -> list[GenerationOutputOut]:
    """Scansione generica di `outputs` nello storico ComfyUI: qualunque lista di
    oggetti con `filename` (ComfyUI la usa per `images`, `gifs`, ... a seconda del
    nodo di salvataggio) — mai un'assunzione sul nome della chiave, che dipende dal
    nodo di output usato nel workflow (coerente con "mai hardcodare cosa un nodo
    specifico produce")."""
    outputs: list[GenerationOutputOut] = []
    raw_outputs = history_entry.get("outputs")
    if not isinstance(raw_outputs, dict):
        return outputs
    for node_output in raw_outputs.values():
        if not isinstance(node_output, dict):
            continue
        for value in node_output.values():
            if not isinstance(value, list):
                continue
            for item in value:
                if isinstance(item, dict) and "filename" in item:
                    outputs.append(
                        GenerationOutputOut(
                            filename=str(item["filename"]),
                            subfolder=str(item.get("subfolder", "")),
                            type=str(item.get("type", "output")),
                        )
                    )
    return outputs


def _to_out(record: GenerationRecord) -> GenerationOut:
    return GenerationOut(
        id=record.id, workflow_id=record.workflow_id, workflow_version_id=record.workflow_version_id,
        comfy_prompt_id=record.comfy_prompt_id, status=record.status, seed=record.seed,
        outputs=[GenerationOutputOut(**o) for o in json.loads(record.output_paths_json)],
        node_errors=json.loads(record.node_errors_json) if record.node_errors_json else None,
        duration_ms=record.duration_ms, error_message=record.error_message,
        created_at=_aware_utc(record.created_at), started_at=_aware_utc(record.started_at),
        finished_at=_aware_utc(record.finished_at),
    )


def _map_comfy_error(exc: Exception, base_url: str) -> HTTPException:
    if isinstance(exc, ComfyUnreachable):
        return HTTPException(status_code=503, detail=f"ComfyUI non raggiungibile su {base_url}")
    if isinstance(exc, ComfyTimeout):
        return HTTPException(status_code=504, detail="Timeout durante la comunicazione con ComfyUI")
    if isinstance(exc, ComfyHTTPError):
        return HTTPException(status_code=502, detail=f"ComfyUI ha risposto con errore HTTP {exc.status_code}: {exc.body[:300]}")
    return HTTPException(status_code=502, detail=f"Risposta di ComfyUI non riconosciuta: {exc}")


@router.post("/workflows/{workflow_id}/generate", response_model=GenerationOut)
async def generate(
    workflow_id: str,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> GenerationOut:
    """Compila il workflow verso il payload API ComfyUI e lo mette in coda (spec §18).
    Blocco rigido (§26) se la validazione strutturale trova errori: mai inviare a
    ComfyUI un grafo che sappiamo già rotto."""
    workflow = await session.get(WorkflowRecord, workflow_id)
    if workflow is None or workflow.current_version_id is None:
        raise HTTPException(status_code=404, detail="Workflow non trovato")
    version = await session.get(WorkflowVersionRecord, workflow.current_version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="Workflow non trovato (versione mancante)")

    graph = WorkflowGraph.model_validate_json(version.graph_json)
    schemas = await _known_node_schemas(session)
    issues = validate_structure(graph, schemas)
    error_messages = [i.message for i in issues if i.severity == "error"]
    if error_messages:
        raise HTTPException(
            status_code=422,
            detail="Il workflow ha errori di validazione da correggere prima di generare: " + "; ".join(error_messages),
        )

    try:
        payload = compile_to_comfy_payload(graph, schemas)
    except CompileError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    instance = await session.get(ComfyInstanceRecord, DEFAULT_INSTANCE_ID)
    if instance is None:
        raise HTTPException(status_code=503, detail="Nessuna istanza ComfyUI configurata — apri Bridge ComfyUI nelle impostazioni")
    client = _client_for(instance, settings)

    try:
        result = await client.queue_prompt(payload, client_id=uuid.uuid4().hex)
    except (ComfyUnreachable, ComfyTimeout, ComfyHTTPError, ComfyProtocolError) as exc:
        raise _map_comfy_error(exc, instance.base_url) from exc

    version.comfy_api_payload_json = json.dumps(payload)

    # ComfyUI accetta comunque la richiesta (prompt_id valorizzato) anche quando
    # node_errors non è vuoto, ma NON eseguirà mai quel job — trattarlo come "queued"
    # sarebbe fuorviante: lo segnaliamo subito come errore, con i messaggi originali di
    # ComfyUI (mai reinterpretati).
    is_rejected = bool(result.node_errors)
    now = datetime.now(UTC)
    generation = GenerationRecord(
        workflow_id=workflow_id, workflow_version_id=version.id, comfy_instance_id=instance.id,
        comfy_prompt_id=result.prompt_id, status="error" if is_rejected else "queued",
        node_errors_json=json.dumps(result.node_errors) if result.node_errors else None,
        error_message="ComfyUI ha rifiutato il job per errori di validazione sui nodi (vedi node_errors)." if is_rejected else None,
        started_at=now if is_rejected else None, finished_at=now if is_rejected else None,
    )
    session.add(generation)
    await session.flush()

    return _to_out(generation)


@router.get("/generations", response_model=list[GenerationOut])
async def list_generations(
    workflow_id: str | None = None, session: AsyncSession = Depends(get_db_session)
) -> list[GenerationOut]:
    stmt = select(GenerationRecord).order_by(GenerationRecord.created_at.desc())
    if workflow_id:
        stmt = stmt.where(GenerationRecord.workflow_id == workflow_id)
    rows = (await session.execute(stmt)).scalars().all()
    return [_to_out(r) for r in rows]


@router.get("/generations/{generation_id}", response_model=GenerationOut)
async def get_generation(
    generation_id: str, session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)
) -> GenerationOut:
    """Restituisce lo stato della generazione, aggiornandolo dal vivo (polling, vedi
    nota di modulo) se non è ancora in uno stato terminale."""
    generation = await session.get(GenerationRecord, generation_id)
    if generation is None:
        raise HTTPException(status_code=404, detail="Generazione non trovata")
    if generation.status in ("completed", "error", "aborted"):
        return _to_out(generation)

    instance = await session.get(ComfyInstanceRecord, generation.comfy_instance_id)
    if instance is None or generation.comfy_prompt_id is None:
        return _to_out(generation)
    client = _client_for(instance, settings)

    try:
        history_entry = await client.get_history(generation.comfy_prompt_id)
    except (ComfyUnreachable, ComfyTimeout, ComfyHTTPError, ComfyProtocolError) as exc:
        # ComfyUI momentaneamente irraggiungibile: non è un errore DELLA generazione,
        # riportiamo lo stato così com'è invece di romperlo con un'eccezione HTTP.
        logger.warning("Impossibile aggiornare lo stato della generazione %s: %s", generation_id, exc)
        return _to_out(generation)

    now = datetime.now(UTC)
    if history_entry is not None:
        status_info = history_entry.get("status") if isinstance(history_entry.get("status"), dict) else {}
        status_str = status_info.get("status_str")
        if status_str == "error":
            generation.status = "error"
            messages = status_info.get("messages")
            generation.error_message = json.dumps(messages) if messages else "ComfyUI ha segnalato un errore di esecuzione."
        else:
            generation.status = "completed"
            generation.output_paths_json = json.dumps([o.model_dump() for o in _extract_outputs(history_entry)])
        generation.finished_at = now
        if generation.started_at is None:
            generation.started_at = now
        generation.duration_ms = int((now - _aware_utc(generation.started_at)).total_seconds() * 1000)
    else:
        try:
            queue_state = await client.get_queue()
        except (ComfyUnreachable, ComfyTimeout, ComfyHTTPError, ComfyProtocolError) as exc:
            logger.warning("Impossibile leggere /queue per la generazione %s: %s", generation_id, exc)
            return _to_out(generation)
        if generation.comfy_prompt_id in queue_state.running_prompt_ids:
            generation.status = "running"
            if generation.started_at is None:
                generation.started_at = now
        elif generation.comfy_prompt_id in queue_state.pending_prompt_ids:
            generation.status = "queued"
        # Né in coda né nello storico: stato ambiguo con il solo polling (nessuna relay
        # WS in questa consegna) — lasciato invariato piuttosto che indovinare.

    await session.flush()
    return _to_out(generation)


@router.post("/generations/{generation_id}/abort", response_model=GenerationOut)
async def abort_generation(
    generation_id: str, session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)
) -> GenerationOut:
    generation = await session.get(GenerationRecord, generation_id)
    if generation is None:
        raise HTTPException(status_code=404, detail="Generazione non trovata")
    if generation.status in ("completed", "error", "aborted"):
        return _to_out(generation)  # già terminata: no-op idempotente

    instance = await session.get(ComfyInstanceRecord, generation.comfy_instance_id)
    if instance is None:
        raise HTTPException(status_code=503, detail="Istanza ComfyUI non trovata per questa generazione")
    client = _client_for(instance, settings)

    try:
        await client.interrupt(prompt_id=generation.comfy_prompt_id)
    except (ComfyUnreachable, ComfyTimeout, ComfyHTTPError, ComfyProtocolError) as exc:
        # Non segniamo "aborted" se non sappiamo se l'interrupt è arrivato davvero a
        # ComfyUI: sarebbe uno stato inventato.
        raise _map_comfy_error(exc, instance.base_url) from exc

    generation.status = "aborted"
    generation.finished_at = datetime.now(UTC)
    await session.flush()
    return _to_out(generation)


@router.get("/generations/{generation_id}/outputs/{index}/file")
async def get_generation_output_file(
    generation_id: str, index: int, session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)
) -> Response:
    """Proxy dei byte di un output verso GET /view di ComfyUI — il frontend non deve
    mai contattare ComfyUI direttamente (unico punto di contatto, docs/module-boundaries.md)."""
    generation = await session.get(GenerationRecord, generation_id)
    if generation is None:
        raise HTTPException(status_code=404, detail="Generazione non trovata")
    outputs = json.loads(generation.output_paths_json)
    if index < 0 or index >= len(outputs):
        raise HTTPException(status_code=404, detail="Output non trovato")
    output = outputs[index]

    instance = await session.get(ComfyInstanceRecord, generation.comfy_instance_id)
    if instance is None:
        raise HTTPException(status_code=503, detail="Istanza ComfyUI non trovata per questa generazione")
    client = _client_for(instance, settings)

    try:
        data = await client.get_view_bytes(output["filename"], output.get("subfolder", ""), output.get("type", "output"))
    except (ComfyUnreachable, ComfyTimeout, ComfyHTTPError, ComfyProtocolError) as exc:
        raise _map_comfy_error(exc, instance.base_url) from exc

    media_type = mimetypes.guess_type(output["filename"])[0] or "application/octet-stream"
    return Response(content=data, media_type=media_type)
