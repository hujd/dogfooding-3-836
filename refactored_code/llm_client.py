"""大模型 API 客户端 - 重构版"""
from __future__ import annotations

import asyncio
from typing import Protocol

import httpx

from ..config import Settings


class LLMClient(Protocol):
    """LLM 客户端协议"""
    async def call(
        self, 
        system_prompt: str, 
        user_prompt: str, 
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> str: ...


class OpenAIClient:
    """OpenAI API 客户端（支持连接复用）"""

    def __init__(self, settings: Settings):
        self._settings = settings
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """获取或创建 HTTP 客户端"""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self._settings.llm_timeout)
        return self._client

    async def close(self) -> None:
        """关闭客户端连接"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def call(
        self, 
        system_prompt: str, 
        user_prompt: str, 
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> str:
        """调用大模型 API，返回模型原始响应文本"""
        model = model or self._settings.llm_model
        temperature = temperature if temperature is not None else self._settings.llm_temperature
        max_tokens = max_tokens or self._settings.llm_max_tokens

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._settings.get_api_key()}",
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

        client = await self._get_client()
        
        try:
            resp = await client.post(
                self._settings.llm_api_url, 
                json=payload, 
                headers=headers
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPStatusError as e:
            raise LLMError(f"API 请求失败: status={e.response.status_code}") from e
        except httpx.RequestError as e:
            raise LLMError(f"网络请求错误: {e}") from e
        except KeyError as e:
            raise LLMError(f"响应格式错误: 缺少字段 {e}") from e

        return data["choices"][0]["message"]["content"]


class LLMError(Exception):
    """LLM 调用错误"""
    pass


# 全局客户端实例
_client: OpenAIClient | None = None


def get_client() -> OpenAIClient:
    """获取客户端实例（单例）"""
    global _client
    if _client is None:
        from ..config import settings
        _client = OpenAIClient(settings)
    return _client
