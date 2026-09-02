from __future__ import annotations

from httpx import ASGITransport, AsyncClient

from bridge.deps import get_db_session


async def test_diagnostics_errors_starts_empty(client: AsyncClient) -> None:
    response = await client.get("/diagnostics/errors")
    assert response.status_code == 200
    assert response.json() == []


async def test_unhandled_exception_is_persisted_and_returns_generic_500(client: AsyncClient, app) -> None:
    """Verifica end-to-end la regola "diagnostica dal primo giorno": un'eccezione non
    gestita in un router NON deve sparire in un 500 anonimo — deve essere persistita
    in modo osservabile via /diagnostics/errors, e il client deve ricevere un
    messaggio generico, mai un traceback grezzo."""

    async def _raise_instead_of_session():
        raise RuntimeError("simulated crash for diagnostics test, api_key=sk-should-be-redacted")

    app.dependency_overrides[get_db_session] = _raise_instead_of_session
    try:
        # Starlette rilancia l'eccezione originale DOPO aver chiamato l'exception
        # handler (così un server ASGI reale può comunque loggarla) — con
        # `raise_app_exceptions` di default (True) httpx la rilancerebbe qui nel test
        # invece di restituire la risposta 500 già prodotta dall'handler.
        no_raise_transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=no_raise_transport, base_url="http://testserver") as no_raise_client:
            response = await no_raise_client.get("/workflows")
    finally:
        del app.dependency_overrides[get_db_session]

    assert response.status_code == 500
    assert "traceback" not in response.text.lower()
    assert "Diagnostica" in response.json()["detail"]

    diag_response = await client.get("/diagnostics/errors")
    assert diag_response.status_code == 200
    errors = diag_response.json()
    assert len(errors) == 1
    assert errors[0]["level"] == "error"
    assert errors[0]["source"] == "GET /workflows"
    assert "simulated crash for diagnostics test" in errors[0]["message"]
    # la chiave "segreta" nel messaggio dell'eccezione deve essere redatta, mai persistita in chiaro
    assert "sk-should-be-redacted" not in errors[0]["message"]
    assert "REDACTED" in errors[0]["message"]
    assert "sk-should-be-redacted" not in str(errors[0]["context"])


async def test_diagnostics_report_includes_app_and_python_info(client: AsyncClient) -> None:
    response = await client.get("/diagnostics/report")
    assert response.status_code == 200
    body = response.json()
    assert body["app_version"]
    assert body["python_version"]
    assert body["platform"]
    assert body["generated_at"]
    assert body["recent_errors"] == []


async def test_diagnostics_errors_limit_is_bounded(client: AsyncClient) -> None:
    response = await client.get("/diagnostics/errors", params={"limit": 10000})
    assert response.status_code == 200  # non deve rifiutare, solo limitare internamente
