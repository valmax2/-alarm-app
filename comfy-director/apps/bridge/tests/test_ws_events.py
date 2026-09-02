from __future__ import annotations

from bridge.comfy_client.ws_events import parse_comfy_ws_message


def test_parses_progress_message() -> None:
    event = parse_comfy_ws_message(
        '{"type": "progress", "data": {"value": 5, "max": 20, "prompt_id": "abc", "node": "3"}}'
    )
    assert event is not None
    assert event.type == "progress"
    assert event.prompt_id == "abc"
    assert event.node_id == "3"
    assert event.progress_value == 5
    assert event.progress_max == 20


def test_parses_executing_message_with_node() -> None:
    event = parse_comfy_ws_message('{"type": "executing", "data": {"node": "7", "prompt_id": "abc"}}')
    assert event is not None
    assert event.type == "executing"
    assert event.node_id == "7"


def test_executing_with_null_node_means_prompt_finished() -> None:
    """ComfyUI invia `node: null` quando l'esecuzione di quel prompt_id è terminata —
    deve restare distinguibile da "nessun dato" (node_id None per assenza vs per fine
    esecuzione sono la stessa cosa qui, corretto: il chiamante lo interpreta guardando
    `type == "executing" and node_id is None`, non questa funzione)."""
    event = parse_comfy_ws_message('{"type": "executing", "data": {"node": null, "prompt_id": "abc"}}')
    assert event is not None
    assert event.type == "executing"
    assert event.node_id is None
    assert event.prompt_id == "abc"


def test_status_message_has_no_prompt_id() -> None:
    event = parse_comfy_ws_message('{"type": "status", "data": {"status": {"exec_info": {"queue_remaining": 1}}}}')
    assert event is not None
    assert event.type == "status"
    assert event.prompt_id is None


def test_unknown_type_is_not_dropped() -> None:
    """Un tipo di messaggio non ancora noto (nuova versione ComfyUI) non deve essere
    scartato silenziosamente — 'unknown' invece di sollevare o inventare un tipo noto."""
    event = parse_comfy_ws_message('{"type": "some_future_type", "data": {"prompt_id": "abc"}}')
    assert event is not None
    assert event.type == "unknown"
    assert event.prompt_id == "abc"


def test_malformed_json_returns_none() -> None:
    assert parse_comfy_ws_message("not json at all") is None


def test_json_array_returns_none() -> None:
    assert parse_comfy_ws_message("[1, 2, 3]") is None


def test_missing_type_returns_none() -> None:
    assert parse_comfy_ws_message('{"data": {"prompt_id": "abc"}}') is None


def test_missing_data_defaults_to_empty() -> None:
    event = parse_comfy_ws_message('{"type": "status"}')
    assert event is not None
    assert event.prompt_id is None
    assert event.progress_value is None
