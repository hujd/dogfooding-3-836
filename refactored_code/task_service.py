"""任务服务层 - 重构版"""
from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone

from ..models import (
    AnalyzeRequest, 
    TaskResponse, 
    TaskStatus, 
    EvaluationResult
)
from .llm_client import get_client, LLMError
from .evaluator import evaluate_task
from .prompt_builder import build_prompt
from .store import get_store


class TaskService:
    """任务管理服务"""

    def __init__(self):
        self._client = get_client()
        self._store = get_store()

    def _generate_task_id(self) -> str:
        """生成唯一任务 ID"""
        timestamp = int(time.time() * 1000)
        random_part = uuid.uuid4().hex[:8]
        return f"{timestamp}-{random_part}"

    async def create_and_execute(self, req: AnalyzeRequest) -> TaskResponse:
        """创建并执行分析任务"""
        system_prompt, user_prompt = build_prompt(req)
        model = req.model or self._get_default_model()

        task = TaskResponse(
            task_id=self._generate_task_id(),
            dimension=req.dimension,
            code=req.code,
            language=req.language,
            model_used=model,
            prompt_sent=user_prompt,
            status=TaskStatus.RUNNING,
        )

        try:
            response = await self._client.call(system_prompt, user_prompt, model=model)
            task.model_response = response
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.now(timezone.utc).isoformat()
        except LLMError as e:
            task.status = TaskStatus.FAILED
            task.error = str(e)
        except Exception as e:
            task.status = TaskStatus.FAILED
            task.error = f"未知错误: {e}"

        await self._store.save_task(task)
        return task

    async def get_task(self, task_id: str) -> TaskResponse | None:
        """获取任务"""
        return await self._store.get_task(task_id)

    async def list_tasks(
        self, 
        dimension: str | None = None, 
        status: str | None = None, 
        limit: int = 50
    ) -> list[TaskResponse]:
        """列出任务"""
        dim = None
        if dimension:
            try:
                from ..models import Dimension
                dim = Dimension(dimension)
            except ValueError:
                pass
        return await self._store.list_tasks(dim, status, limit)

    async def evaluate(
        self, 
        task_id: str, 
        reference_answer: str | None = None
    ) -> EvaluationResult:
        """评估任务结果"""
        task = await self._store.get_task(task_id)
        if not task:
            raise TaskNotFoundError(f"任务不存在: {task_id}")
        if task.status != TaskStatus.COMPLETED:
            raise TaskNotCompletedError(f"任务未完成: status={task.status.value}")

        result = await evaluate_task(task, reference_answer)
        await self._store.save_evaluation(result)
        return result

    async def get_evaluation(self, task_id: str) -> EvaluationResult | None:
        """获取评估结果"""
        return await self._store.get_evaluation(task_id)

    def _get_default_model(self) -> str:
        """获取默认模型"""
        from ..config import settings
        return settings.llm_model


class TaskNotFoundError(Exception):
    """任务不存在错误"""
    pass


class TaskNotCompletedError(Exception):
    """任务未完成错误"""
    pass


# 全局服务实例
_service: TaskService | None = None


def get_service() -> TaskService:
    """获取服务实例（单例）"""
    global _service
    if _service is None:
        _service = TaskService()
    return _service
