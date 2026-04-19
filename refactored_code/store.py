"""任务存储抽象层 - 重构版"""
from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from typing import Protocol

from ..models import TaskResponse, EvaluationResult, Dimension


class TaskStore(ABC):
    """任务存储抽象接口"""

    @abstractmethod
    async def save_task(self, task: TaskResponse) -> None:
        """保存任务"""
        ...

    @abstractmethod
    async def get_task(self, task_id: str) -> TaskResponse | None:
        """获取任务"""
        ...

    @abstractmethod
    async def list_tasks(
        self, 
        dimension: Dimension | None = None, 
        status: str | None = None, 
        limit: int = 50
    ) -> list[TaskResponse]:
        """列出任务"""
        ...

    @abstractmethod
    async def save_evaluation(self, evaluation: EvaluationResult) -> None:
        """保存评估结果"""
        ...

    @abstractmethod
    async def get_evaluation(self, task_id: str) -> EvaluationResult | None:
        """获取评估结果"""
        ...


class InMemoryTaskStore(TaskStore):
    """内存存储实现（线程安全）"""

    def __init__(self):
        self._tasks: dict[str, TaskResponse] = {}
        self._evaluations: dict[str, EvaluationResult] = {}
        self._lock = asyncio.Lock()

    async def save_task(self, task: TaskResponse) -> None:
        async with self._lock:
            self._tasks[task.task_id] = task

    async def get_task(self, task_id: str) -> TaskResponse | None:
        async with self._lock:
            return self._tasks.get(task_id)

    async def list_tasks(
        self, 
        dimension: Dimension | None = None, 
        status: str | None = None, 
        limit: int = 50
    ) -> list[TaskResponse]:
        async with self._lock:
            results = list(self._tasks.values())
            if dimension:
                results = [t for t in results if t.dimension == dimension]
            if status:
                results = [t for t in results if t.status.value == status]
            return results[-limit:]

    async def save_evaluation(self, evaluation: EvaluationResult) -> None:
        async with self._lock:
            self._evaluations[evaluation.task_id] = evaluation

    async def get_evaluation(self, task_id: str) -> EvaluationResult | None:
        async with self._lock:
            return self._evaluations.get(task_id)


# 全局存储实例
_store: TaskStore | None = None


def get_store() -> TaskStore:
    """获取存储实例（单例）"""
    global _store
    if _store is None:
        _store = InMemoryTaskStore()
    return _store


def set_store(store: TaskStore) -> None:
    """设置存储实例（用于依赖注入）"""
    global _store
    _store = store
