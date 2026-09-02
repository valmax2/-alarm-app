from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bridge.deps import get_db_session
from bridge.inventory.family_detection import KNOWN_FAMILIES
from bridge.inventory.sync import DEFAULT_INSTANCE_ID
from bridge.models import NodeRecord, NodeSchemaRecord, WorkflowRecord, WorkflowVersionRecord
from bridge.schemas import (
    ValidationIssueOut,
    WorkflowCreateRequest,
    WorkflowDetailOut,
    WorkflowGraphIn,
    WorkflowImportJsonRequest,
    WorkflowImportJsonResponse,
    WorkflowSaveRequest,
    WorkflowSummaryOut,
)
from bridge.workflow import NodeSchemaInfo, WorkflowGraph, validate_structure
from bridge.workflow_import import WorkflowJsonImportError, import_workflow_json

router = APIRouter(prefix="/workflows", tags=["workflows"])


async def _known_node_schemas(session: AsyncSession) -> dict[str, NodeSchemaInfo]:
    """Schema di tutti i nodi dell'ultimo inventario sincronizzato — usato per validare
    la struttura del grafo (bridge.workflow.validate_structure)."""
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


def _empty_graph_json() -> str:
    return WorkflowGraph().model_dump_json()


@router.get("/known-families", response_model=list[str])
async def get_known_families() -> list[str]:
    """Famiglie note "di esempio" (spec §4/§14) per il selettore di creazione workflow.
    Elenco esplicitamente non chiuso (bridge.inventory.family_detection) — l'utente può
    comunque lasciare il campo vuoto o, in futuro, digitarne una libera."""
    return list(KNOWN_FAMILIES)


@router.post("", response_model=WorkflowSummaryOut)
async def create_workflow(
    payload: WorkflowCreateRequest, session: AsyncSession = Depends(get_db_session)
) -> WorkflowSummaryOut:
    family = payload.family.strip() if payload.family and payload.family.strip() else None
    workflow = WorkflowRecord(name=payload.name, family=family, source="user_created")
    session.add(workflow)
    await session.flush()

    version = WorkflowVersionRecord(
        workflow_id=workflow.id, version_number=1, graph_json=_empty_graph_json(),
    )
    session.add(version)
    await session.flush()

    workflow.current_version_id = version.id
    await session.flush()

    return WorkflowSummaryOut(
        id=workflow.id, name=workflow.name, intent=workflow.intent, family=workflow.family,
        source=workflow.source, node_count=0, edge_count=0, updated_at=workflow.updated_at,
    )


@router.post("/import-json", response_model=WorkflowImportJsonResponse)
async def import_workflow_from_json(
    payload: WorkflowImportJsonRequest, session: AsyncSession = Depends(get_db_session)
) -> WorkflowImportJsonResponse:
    """Importa un workflow ComfyUI da un file .json standalone (non da immagine — vedi
    /workflow-import/from-image per quello), riconoscendo sia il formato API sia
    quello UI (bridge.workflow_import.from_json). Crea subito un nuovo workflow
    apribile in canvas, con il grafo reale ricostruito."""
    schemas = await _known_node_schemas(session)
    try:
        result = import_workflow_json(payload.raw_json, schemas)
    except WorkflowJsonImportError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    workflow = WorkflowRecord(name=payload.name, source="imported_json")
    session.add(workflow)
    await session.flush()

    version = WorkflowVersionRecord(workflow_id=workflow.id, version_number=1, graph_json=result.graph.model_dump_json())
    session.add(version)
    await session.flush()

    workflow.current_version_id = version.id
    await session.flush()

    return WorkflowImportJsonResponse(
        workflow=WorkflowSummaryOut(
            id=workflow.id, name=workflow.name, intent=workflow.intent, family=workflow.family,
            source=workflow.source, node_count=result.node_count, edge_count=result.edge_count,
            updated_at=workflow.updated_at,
        ),
        source=result.source,
        unmapped_widget_node_types=result.unmapped_widget_node_types,
    )


@router.get("", response_model=list[WorkflowSummaryOut])
async def list_workflows(session: AsyncSession = Depends(get_db_session)) -> list[WorkflowSummaryOut]:
    workflows = (await session.execute(select(WorkflowRecord).order_by(WorkflowRecord.updated_at.desc()))).scalars().all()
    result = []
    for w in workflows:
        node_count = edge_count = 0
        if w.current_version_id:
            version = await session.get(WorkflowVersionRecord, w.current_version_id)
            if version:
                graph = json.loads(version.graph_json)
                node_count, edge_count = len(graph.get("nodes", [])), len(graph.get("edges", []))
        result.append(
            WorkflowSummaryOut(
                id=w.id, name=w.name, intent=w.intent, family=w.family, source=w.source,
                node_count=node_count, edge_count=edge_count, updated_at=w.updated_at,
            )
        )
    return result


@router.get("/{workflow_id}", response_model=WorkflowDetailOut)
async def get_workflow(workflow_id: str, session: AsyncSession = Depends(get_db_session)) -> WorkflowDetailOut:
    workflow = await session.get(WorkflowRecord, workflow_id)
    if workflow is None or workflow.current_version_id is None:
        raise HTTPException(status_code=404, detail="Workflow non trovato")
    version = await session.get(WorkflowVersionRecord, workflow.current_version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="Workflow non trovato (versione mancante)")

    graph = WorkflowGraph.model_validate_json(version.graph_json)
    schemas = await _known_node_schemas(session)
    issues = validate_structure(graph, schemas)

    return WorkflowDetailOut(
        id=workflow.id, name=workflow.name, intent=workflow.intent, family=workflow.family,
        source=workflow.source, version_number=version.version_number,
        graph=WorkflowGraphIn(nodes=graph.nodes, edges=graph.edges),
        validation_issues=[ValidationIssueOut(severity=i.severity, node_id=i.node_id, message=i.message) for i in issues],
        updated_at=workflow.updated_at,
    )


@router.put("/{workflow_id}", response_model=WorkflowDetailOut)
async def save_workflow(
    workflow_id: str, payload: WorkflowSaveRequest, session: AsyncSession = Depends(get_db_session)
) -> WorkflowDetailOut:
    """Salva lo stato corrente del grafo come nuova versione (spec §28: ogni modifica
    importante crea un checkpoint). Il salvataggio riesce anche in presenza di
    problemi di validazione (sono informativi qui — il blocco rigido "prima di
    GENERA" è Fase 6, §26): l'utente può salvare un lavoro a metà senza perderlo."""
    workflow = await session.get(WorkflowRecord, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow non trovato")

    graph = WorkflowGraph(nodes=payload.graph.nodes, edges=payload.graph.edges)
    schemas = await _known_node_schemas(session)
    issues = validate_structure(graph, schemas)

    last_version_number = (
        await session.execute(
            select(WorkflowVersionRecord.version_number)
            .where(WorkflowVersionRecord.workflow_id == workflow_id)
            .order_by(WorkflowVersionRecord.version_number.desc())
            .limit(1)
        )
    ).scalar_one_or_none() or 0

    version = WorkflowVersionRecord(
        workflow_id=workflow_id, version_number=last_version_number + 1, graph_json=graph.model_dump_json(),
        validation_result_json=json.dumps([i.model_dump() for i in issues]), note=payload.note,
    )
    session.add(version)
    await session.flush()

    workflow.current_version_id = version.id
    await session.flush()

    return WorkflowDetailOut(
        id=workflow.id, name=workflow.name, intent=workflow.intent, family=workflow.family,
        source=workflow.source, version_number=version.version_number,
        graph=WorkflowGraphIn(nodes=graph.nodes, edges=graph.edges),
        validation_issues=[ValidationIssueOut(severity=i.severity, node_id=i.node_id, message=i.message) for i in issues],
        updated_at=workflow.updated_at,
    )


@router.delete("/{workflow_id}", status_code=204)
async def delete_workflow(workflow_id: str, session: AsyncSession = Depends(get_db_session)) -> None:
    workflow = await session.get(WorkflowRecord, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow non trovato")
    await session.delete(workflow)
