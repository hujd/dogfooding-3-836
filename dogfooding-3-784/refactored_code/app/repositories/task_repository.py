"""任务存储仓库 - 抽象和实现"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional
from datetime import datetime, timezone

from ..models import TaskResponse, EvaluationResult, TaskStatus


class TaskRepository(ABC):
    """任务存储抽象基类"""

    @abstractmethod
    async def save_task(self, task: TaskResponse) -> None:
        """保存任务"""
        pass

    @abstractmethod
    async def get_task(self, task_id: str) -> Optional[TaskResponse]:
        """获取任务"""
        pass

    @abstractmethod
    async def list_tasks(
        self, dimension: Optional[str] = None, status: Optional[str] = None, limit: int = 50
    ) -> list[TaskResponse]:
        """列出任务"""
        pass

    @abstractmethod
    async def save_evaluation(self, evaluation: EvaluationResult) -> None:
        """保存评分"""
        pass

    @abstractmethod
    async def get_evaluation(self, task_id: str) -> Optional[EvaluationResult]:
        """获取评分"""
        pass


class InMemoryTaskRepository(TaskRepository):
    """内存存储实现 - 适用于开发和测试"""

    def __init__(self):
        self._tasks: dict[str, TaskResponse] = {}
        self._evaluations: dict[str, EvaluationResult] = {}

    async def save_task(self, task: TaskResponse) -> None:
        """保存任务到内存"""
        self._tasks[task.task_id] = task

    async def get_task(self, task_id: str) -> Optional[TaskResponse]:
        """从内存获取任务"""
        return self._tasks.get(task_id)

    async def list_tasks(
        self, dimension: Optional[str] = None, status: Optional[str] = None, limit: int = 50
    ) -> list[TaskResponse]:
        """列出任务，支持过滤"""
        results = list(self._tasks.values())

        if dimension:
            results = [t for t in results if t.dimension.value == dimension]
        if status:
            results = [t for t in results if t.status.value == status]

        return results[-limit:]

    async def save_evaluation(self, evaluation: EvaluationResult) -> None:
        """保存评分到内存"""
        self._evaluations[evaluation.task_id] = evaluation

    async def get_evaluation(self, task_id: str) -> Optional[EvaluationResult]:
        """从内存获取评分"""
        return self._evaluations.get(task_id)