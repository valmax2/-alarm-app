from __future__ import annotations

import httpx
import pytest
import respx

from bridge.ai_providers import (
    ChatHTTPError,
    UnsupportedChatProviderKindError,
    translate_to_english,
)


@respx.mock
async def test_translate_to_english_anthropic_strips_whitespace():
    respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(200, json={"content": [{"type": "text", "text": "  a cat sitting on a windowsill  "}]})
    )
    result = await translate_to_english(kind="anthropic", api_key="sk-fake", text_it="un gatto seduto sul davanzale")
    assert result == "a cat sitting on a windowsill"


@respx.mock
async def test_translate_to_english_openai():
    respx.post("https://api.openai.com/v1/chat/completions").mock(
        return_value=httpx.Response(200, json={"choices": [{"message": {"content": "a cat"}}]})
    )
    result = await translate_to_english(kind="openai", api_key="sk-fake", text_it="un gatto")
    assert result == "a cat"


@respx.mock
async def test_translate_to_english_sends_translation_system_prompt_not_chat_one():
    route = respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(200, json={"content": [{"type": "text", "text": "hello"}]})
    )
    await translate_to_english(kind="anthropic", api_key="sk-fake", text_it="ciao")
    import json

    body = json.loads(route.calls.last.request.content)
    assert "traduttore" in body["system"].lower()
    assert body["messages"] == [{"role": "user", "content": "ciao"}]


@respx.mock
async def test_translate_to_english_surfaces_http_error():
    respx.post("https://api.anthropic.com/v1/messages").mock(return_value=httpx.Response(401, json={"error": "bad key"}))
    with pytest.raises(ChatHTTPError):
        await translate_to_english(kind="anthropic", api_key="bad", text_it="ciao")


async def test_translate_to_english_rejects_local_kind():
    with pytest.raises(UnsupportedChatProviderKindError):
        await translate_to_english(kind="local", api_key="x", text_it="ciao")
