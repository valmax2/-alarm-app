from __future__ import annotations

import json

import httpx
import pytest
import respx

from bridge.ai_providers.vision import (
    UnsupportedProviderKindError,
    VisionHTTPError,
    VisionProtocolError,
    VisionTimeout,
    VisionUnreachable,
    analyze_image_to_prompt,
    analyze_with_anthropic,
    analyze_with_openai,
)

STRUCTURED_JSON = {
    "subject": "a woman",
    "identity": "adult",
    "hair": "long brown hair",
    "face": "oval face",
    "body_clothing": "red jacket",
    "pose_action": "standing, looking at camera",
    "environment": "city street at night",
    "camera": "medium shot",
    "light": "neon lighting",
    "style": "photorealistic",
    "details": "rain reflections",
    "final_prompt_en": "photorealistic portrait of a woman with long brown hair, red jacket, city street at night, neon lighting",
}


@respx.mock
async def test_analyze_with_anthropic_parses_structured_response() -> None:
    respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(
            200, json={"content": [{"type": "text", "text": json.dumps(STRUCTURED_JSON)}]}
        )
    )
    result = await analyze_with_anthropic("sk-ant-fake", "AAAA", "image/png", "claude-sonnet-5")
    assert result.subject == "a woman"
    assert result.final_prompt_en.startswith("photorealistic portrait")


@respx.mock
async def test_analyze_with_anthropic_sends_correct_request_shape() -> None:
    route = respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(200, json={"content": [{"type": "text", "text": json.dumps(STRUCTURED_JSON)}]})
    )
    await analyze_with_anthropic("sk-ant-fake", "AAAA", "image/jpeg", "claude-sonnet-5")

    request = route.calls[0].request
    assert request.headers["x-api-key"] == "sk-ant-fake"
    body = json.loads(request.content)
    assert body["model"] == "claude-sonnet-5"
    image_block = body["messages"][0]["content"][0]
    assert image_block["type"] == "image"
    assert image_block["source"]["media_type"] == "image/jpeg"
    assert image_block["source"]["data"] == "AAAA"


@respx.mock
async def test_analyze_with_openai_parses_structured_response() -> None:
    respx.post("https://api.openai.com/v1/chat/completions").mock(
        return_value=httpx.Response(
            200, json={"choices": [{"message": {"content": json.dumps(STRUCTURED_JSON)}}]}
        )
    )
    result = await analyze_with_openai("sk-oai-fake", "AAAA", "image/png", "gpt-4o")
    assert result.hair == "long brown hair"


@respx.mock
async def test_analyze_with_openai_uses_custom_base_url_when_given() -> None:
    route = respx.post("https://my-compatible-endpoint.example/v1/chat/completions").mock(
        return_value=httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(STRUCTURED_JSON)}}]})
    )
    await analyze_with_openai(
        "sk-fake", "AAAA", "image/png", "some-vision-model", base_url="https://my-compatible-endpoint.example"
    )
    assert route.called


@respx.mock
async def test_tolerates_json_wrapped_in_markdown_code_fence() -> None:
    wrapped = "```json\n" + json.dumps(STRUCTURED_JSON) + "\n```"
    respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(200, json={"content": [{"type": "text", "text": wrapped}]})
    )
    result = await analyze_with_anthropic("sk-ant-fake", "AAAA", "image/png", "claude-sonnet-5")
    assert result.subject == "a woman"


@respx.mock
async def test_raises_protocol_error_on_incomplete_json() -> None:
    incomplete = {k: v for k, v in STRUCTURED_JSON.items() if k != "final_prompt_en"}
    respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(200, json={"content": [{"type": "text", "text": json.dumps(incomplete)}]})
    )
    with pytest.raises(VisionProtocolError):
        await analyze_with_anthropic("sk-ant-fake", "AAAA", "image/png", "claude-sonnet-5")


@respx.mock
async def test_raises_protocol_error_on_non_json_text() -> None:
    respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(200, json={"content": [{"type": "text", "text": "sorry, I cannot help"}]})
    )
    with pytest.raises(VisionProtocolError):
        await analyze_with_anthropic("sk-ant-fake", "AAAA", "image/png", "claude-sonnet-5")


@respx.mock
async def test_raises_http_error_on_4xx() -> None:
    respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(401, json={"error": {"message": "invalid x-api-key"}})
    )
    with pytest.raises(VisionHTTPError) as exc_info:
        await analyze_with_anthropic("sk-bad", "AAAA", "image/png", "claude-sonnet-5")
    assert exc_info.value.status_code == 401


@respx.mock
async def test_raises_unreachable_on_connect_error() -> None:
    respx.post("https://api.anthropic.com/v1/messages").mock(side_effect=httpx.ConnectError("refused"))
    with pytest.raises(VisionUnreachable):
        await analyze_with_anthropic("sk-ant-fake", "AAAA", "image/png", "claude-sonnet-5")


@respx.mock
async def test_raises_timeout() -> None:
    respx.post("https://api.anthropic.com/v1/messages").mock(side_effect=httpx.TimeoutException("slow"))
    with pytest.raises(VisionTimeout):
        await analyze_with_anthropic("sk-ant-fake", "AAAA", "image/png", "claude-sonnet-5", timeout_seconds=0.01)


async def test_analyze_image_to_prompt_rejects_unsupported_kind() -> None:
    with pytest.raises(UnsupportedProviderKindError):
        await analyze_image_to_prompt("local", "irrelevant", "AAAA", "image/png")


@respx.mock
async def test_analyze_image_to_prompt_dispatches_to_anthropic() -> None:
    respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(200, json={"content": [{"type": "text", "text": json.dumps(STRUCTURED_JSON)}]})
    )
    result = await analyze_image_to_prompt("anthropic", "sk-ant-fake", "AAAA", "image/png")
    assert result.subject == "a woman"
