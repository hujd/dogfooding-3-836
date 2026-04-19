"""大模型 API 客户端"""
from __future__ import annotations

import httpx

from ..config import settings


async def call_llm(
    system_prompt: str,
    user_prompt: str,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> str:
    """调用大模型 API，返回模型原始响应文本

    Args:
        system_prompt: 系统角色定义提示词
        user_prompt: 用户任务提示词
        model: 模型名称，默认从配置读取
        temperature: 采样温度，默认从配置读取
        max_tokens: 最大生成 token 数，默认从配置读取

    Returns:
        模型生成的响应文本

    Raises:
        httpx.HTTPError: HTTP 请求失败
        KeyError: 响应格式异常
    """
    model = model or settings.llm_model
    temperature = temperature if temperature is not None else settings.llm_temperature
    max_tokens = max_tokens or settings.llm_max_tokens

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.llm_api_key}",
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(settings.llm_api_url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    return data["choices"][0]["message"]["content"]