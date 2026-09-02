from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bridge.compatibility import filter_models_by_family
from bridge.deps import get_db_session
from bridge.inventory.sync import DEFAULT_INSTANCE_ID
from bridge.models import ModelRecord, NodeRecord
from bridge.schemas import ModelOut, NodeOut

router = APIRouter(prefix="/inventory", tags=["inventory"])

# Fase 2 v1: nessuna paginazione reale (l'hardening delle performance, incluse
# virtualizzazione/paginazione liste, è esplicitamente Fase 11 — spec §35). Un limite
# fisso generoso evita comunque risposte senza limite su installazioni molto grandi.
_MAX_RESULTS = 2000


@router.get("/models", response_model=list[ModelOut])
async def list_models(
    session: AsyncSession = Depends(get_db_session),
    model_type: str | None = Query(default=None),
    family: str | None = Query(
        default=None,
        description=(
            "Famiglia target del contesto corrente (es. 'flux', 'sdxl'). Se presente, "
            "ogni modello viene valutato dal Compatibility Engine rispetto a questa "
            "famiglia (spec §5/§14) invece di un confronto diretto sul campo."
        ),
    ),
    include_incompatible: bool = Query(
        default=False, description="Se false (default) e `family` è impostato, nasconde gli incompatibili."
    ),
    q: str | None = Query(default=None, description="Ricerca testuale sul nome file."),
) -> list[ModelOut]:
    stmt = select(ModelRecord).where(ModelRecord.comfy_instance_id == DEFAULT_INSTANCE_ID)
    if model_type:
        stmt = stmt.where(ModelRecord.model_type == model_type)
    if q:
        stmt = stmt.where(ModelRecord.name.ilike(f"%{q}%"))
    stmt = stmt.order_by(ModelRecord.model_type, ModelRecord.name).limit(_MAX_RESULTS)

    rows = (await session.execute(stmt)).scalars().all()

    if family:
        scored = filter_models_by_family(rows, family)
        if not include_incompatible:
            scored = [s for s in scored if s.result.compatibility != "incompatible"]
        return [
            ModelOut(
                id=s.model.id, name=s.model.name, path=s.model.path, model_type=s.model.model_type,
                extension=s.model.extension, size_bytes=s.model.size_bytes, family=s.model.family,
                detection_confidence=s.model.detection_confidence, detection_source=s.model.detection_source,
                last_seen=s.model.last_seen, compatibility=s.result.compatibility,
                compatibility_reason=s.result.reason,
            )
            for s in scored
        ]

    return [
        ModelOut(
            id=m.id, name=m.name, path=m.path, model_type=m.model_type, extension=m.extension,
            size_bytes=m.size_bytes, family=m.family, detection_confidence=m.detection_confidence,
            detection_source=m.detection_source, last_seen=m.last_seen,
        )
        for m in rows
    ]


@router.get("/nodes", response_model=list[NodeOut])
async def list_nodes(
    session: AsyncSession = Depends(get_db_session),
    is_custom_node: bool | None = Query(default=None),
    q: str | None = Query(default=None, description="Ricerca testuale su class_type/display_name."),
) -> list[NodeOut]:
    stmt = select(NodeRecord).where(NodeRecord.comfy_instance_id == DEFAULT_INSTANCE_ID)
    if is_custom_node is not None:
        stmt = stmt.where(NodeRecord.is_custom_node == is_custom_node)
    if q:
        stmt = stmt.where(
            (NodeRecord.class_type.ilike(f"%{q}%")) | (NodeRecord.display_name.ilike(f"%{q}%"))
        )
    stmt = stmt.order_by(NodeRecord.category, NodeRecord.class_type).limit(_MAX_RESULTS)

    rows = (await session.execute(stmt)).scalars().all()
    return [
        NodeOut(
            class_type=n.class_type, display_name=n.display_name, category=n.category,
            is_custom_node=n.is_custom_node, last_seen=n.last_seen,
        )
        for n in rows
    ]
