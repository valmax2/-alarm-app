from __future__ import annotations

import json

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bridge.deps import get_db_session
from bridge.inventory.sync import DEFAULT_INSTANCE_ID
from bridge.models import (
    ComfyInstanceRecord,
    NodeRecord,
    NodeSchemaRecord,
    WorkflowRecord,
    WorkflowVersionRecord,
)
from bridge.schemas import ImportedNodeOut, WorkflowImportResponse, WorkflowSummaryOut
from bridge.workflow import NodeSchemaInfo
from bridge.workflow_import import (
    WorkflowJsonImportError,
    extract_workflow_from_image,
    import_workflow_json,
)

router = APIRouter(prefix="/workflow-import", tags=["workflow-import"])


async def _known_node_schemas(session: AsyncSession) -> dict[str, NodeSchemaInfo]:
    """Duplicato deliberatamente da `routers/workflows.py` (stessa query, stesso
    scopo) — coerente con la scelta già fatta lì di non condividerla via un modulo
    comune."""
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


@router.post("/from-image", response_model=WorkflowImportResponse)
async def workflow_from_image(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
) -> WorkflowImportResponse:
    """WORKFLOW DA IMMAGINE (spec §8): legge i metadata ComfyUI incorporati nel PNG
    caricato. Se non trovati, lo dice esplicitamente (mai un workflow inventato). Se
    trovati, ogni nodo viene confrontato con l'ultimo inventario sincronizzato (Fase 2)
    per segnalare i componenti mancanti — ma solo se una sync è già stata fatta almeno
    una volta, altrimenti resta onestamente "non verificato".

    Se il grafo trovato è ricostruibile (stessa logica di `POST /workflows/import-json`,
    riusata su `result.raw_graph` — mai duplicata a mano), viene salvato SUBITO come
    workflow reale apribile in canvas: prima di questa consegna questo endpoint si
    fermava a un riassunto di sola lettura, senza nessun collegamento alla canvas
    (Fase 3, costruita da tempo ma mai ricollegata qui — bug corretto)."""
    image_bytes = await file.read()

    instance = await session.get(ComfyInstanceRecord, DEFAULT_INSTANCE_ID)
    known_class_types: set[str] | None = None
    if instance is not None and instance.last_sync_at is not None:
        rows = (
            await session.execute(
                select(NodeRecord.class_type).where(NodeRecord.comfy_instance_id == DEFAULT_INSTANCE_ID)
            )
        ).scalars().all()
        known_class_types = set(rows)

    result = extract_workflow_from_image(image_bytes, known_class_types=known_class_types)

    workflow_out: WorkflowSummaryOut | None = None
    message = result.message
    if result.found and result.raw_graph is not None:
        schemas = await _known_node_schemas(session)
        try:
            imported = import_workflow_json(result.raw_graph, schemas)
        except WorkflowJsonImportError as exc:
            message = f"{message} Trovato ma non è stato possibile aprirlo in canvas: {exc}"
        else:
            base_name = (file.filename or "").rsplit(".", 1)[0].strip()
            workflow = WorkflowRecord(name=base_name or "Workflow da immagine", source="imported_json")
            session.add(workflow)
            await session.flush()

            version = WorkflowVersionRecord(workflow_id=workflow.id, version_number=1, graph_json=imported.graph.model_dump_json())
            session.add(version)
            await session.flush()

            workflow.current_version_id = version.id
            await session.flush()

            workflow_out = WorkflowSummaryOut(
                id=workflow.id, name=workflow.name, intent=workflow.intent, family=workflow.family,
                source=workflow.source, node_count=imported.node_count, edge_count=imported.edge_count,
                updated_at=workflow.updated_at,
            )
            message = f"{message} Aperto in canvas come nuovo workflow."

    return WorkflowImportResponse(
        found=result.found,
        source=result.source,
        node_count=result.node_count,
        link_count=result.link_count,
        nodes=[
            ImportedNodeOut(id=n.id, class_type=n.class_type, title=n.title, present_in_inventory=n.present_in_inventory)
            for n in result.nodes
        ],
        missing_node_types=result.missing_node_types,
        inventory_checked=result.inventory_checked,
        message=message,
        workflow=workflow_out,
    )
