from __future__ import annotations

import httpx
import pytest
import respx

from bridge.ai_providers import (
    ChatHTTPError,
    ChatMessageIn,
    ChatProtocolError,
    ChatUnreachable,
    UnsupportedChatProviderKindError,
    send_chat_message,
)


@respx.mock
async def test_send_chat_message_anthropic_returns_reply_text():
    respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(200, json={"content": [{"type": "text", "text": "Ciao!"}]})
    )
    reply = await send_chat_message(
        kind="anthropic", api_key="sk-fake", history=[ChatMessageIn(role="user", text="ciao")]
    )
    assert reply == "Ciao!"


@respx.mock
async def test_send_chat_message_openai_returns_reply_text():
    respx.post("https://api.openai.com/v1/chat/completions").mock(
        return_value=httpx.Response(200, json={"choices": [{"message": {"content": "Ciao!"}}]})
    )
    reply = await send_chat_message(
        kind="openai", api_key="sk-fake", history=[ChatMessageIn(role="user", text="ciao")]
    )
    assert reply == "Ciao!"


@respx.mock
async def test_send_chat_message_sends_full_history_in_order():
    route = respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(200, json={"content": [{"type": "text", "text": "ok"}]})
    )
    history = [
        ChatMessageIn(role="user", text="primo"),
        ChatMessageIn(role="assistant", text="risposta"),
        ChatMessageIn(role="user", text="secondo"),
    ]
    await send_chat_message(kind="anthropic", api_key="sk-fake", history=history)
    sent = route.calls.last.request.content
    import json

    body = json.loads(sent)
    assert [m["content"] for m in body["messages"]] == ["primo", "risposta", "secondo"]


@respx.mock
async def test_send_chat_message_surfaces_http_error():
    respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(401, json={"error": "invalid key"})
    )
    with pytest.raises(ChatHTTPError):
        await send_chat_message(kind="anthropic", api_key="bad", history=[ChatMessageIn(role="user", text="ciao")])


@respx.mock
async def test_send_chat_message_raises_on_missing_content():
    respx.post("https://api.anthropic.com/v1/messages").mock(return_value=httpx.Response(200, json={}))
    with pytest.raises(ChatProtocolError):
        await send_chat_message(kind="anthropic", api_key="sk-fake", history=[ChatMessageIn(role="user", text="ciao")])


async def test_send_chat_message_rejects_local_kind():
    with pytest.raises(UnsupportedChatProviderKindError):
        await send_chat_message(kind="local", api_key="x", history=[ChatMessageIn(role="user", text="ciao")])


@respx.mock
async def test_send_chat_message_unreachable_raises_typed_error():
    respx.post("https://api.anthropic.com/v1/messages").mock(side_effect=httpx.ConnectError("refused"))
    with pytest.raises(ChatUnreachable):
        await send_chat_message(kind="anthropic", api_key="sk-fake", history=[ChatMessageIn(role="user", text="ciao")])
