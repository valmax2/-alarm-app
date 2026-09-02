from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bridge.deps import get_db_session
from bridge.inventory.sync import DEFAULT_INSTANCE_ID
from bridge.models import ComfyInstanceRecord, NodeRecord
from bridge.schemas import ImportedNodeOut, WorkflowImportResponse
from bridge.workflow_import import extract_workflow_from_image

router = APIRouter(prefix="/workflow-import", tags=["workflow-import"])


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
    """
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
        message=result.message,
    )
