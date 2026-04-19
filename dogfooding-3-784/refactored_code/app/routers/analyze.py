"""代码分析路由 - 重构后版本"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends

from ..models import AnalyzeRequest, EvaluateRequest, TaskResponse, TaskStatus, EvaluationResult
from ..services.prompt_builder import build_prompt
from ..services.llm_client import call_llm
from ..services.evaluator import evaluate_task
from ..repositories.task_repository import TaskRepository, InMemoryTaskRepository
from ..config import settings

router = APIRouter(prefix="/api/v1", tags=["analyze"])


# 依赖注入：获取仓库实例
def get_task_repository() -> TaskRepository:
    """获取任务仓库实例"""
    # 生产环境可替换为 RedisTaskRepository
    return InMemoryTaskRepository()


@router.post("/analyze", response_model=TaskResponse)
async def create_analysis(
    req: AnalyzeRequest,
    repo: TaskRepository = Depends(get_task_repository),
):
    """提交代码分析任务

    Args:
        req: 分析请求
        repo: 任务仓库（依赖注入）

    Returns:
        任务响应
    """
    system_prompt, user_prompt = build_prompt(req)
    model = req.model or settings.llm_model

    # 创建任务（在 try 之前保存，确保失败也能追踪）
    task = TaskResponse(
        dimension=req.dimension,
        code=req.code,
        language=req.language,
        model_used=model,
        prompt_sent=user_prompt,
        status=TaskStatus.RUNNING,
    )
    await repo.save_task(task)

    try:
        # 调用 LLM
        response = await call_llm(system_prompt, user_prompt, model=model)
        task.model_response = response
        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.now(timezone.utc).isoformat()
    except Exception as e:
        task.status = TaskStatus.FAILED
        task.error = str(e)

    # 更新任务状态
    await repo.save_task(task)
    return task


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    repo: TaskRepository = Depends(get_task_repository),
):
    """查询任务结果

    Args:
        task_id: 任务 ID
        repo: 任务仓库

    Raises:
        HTTPException: 任务不存在时返回 404
    """
    task = await repo.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return task


@router.get("/tasks", response_model=list[TaskResponse])
async def list_tasks(
    dimension: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    repo: TaskRepository = Depends(get_task_repository),
):
    """列出所有任务

    Args:
        dimension: 可选的维度过滤
        status: 可选的状态过滤
        limit: 返回数量限制
        repo: 任务仓库

    Returns:
        任务列表
    """
    return await repo.list_tasks(dimension=dimension, status=status, limit=limit)


@router.post("/evaluate", response_model=EvaluationResult)
async def evaluate(
    req: EvaluateRequest,
    repo: TaskRepository = Depends(get_task_repository),
):
    """对模型返回结果进行评分

    Args:
        req: 评分请求
        repo: 任务仓库

    Raises:
        HTTPException: 任务不存在或未完成时返回错误
    """
    task = await repo.get_task(req.task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {req.task_id} not found")
    if task.status != TaskStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Task not completed")

    result = await evaluate_task(task, req.reference_answer)
    await repo.save_evaluation(result)
    return result


@router.get("/evaluations/{task_id}", response_model=EvaluationResult)
async def get_evaluation(
    task_id: str,
    repo: TaskRepository = Depends(get_task_repository),
):
    """查询评分结果

    Args:
        task_id: 任务 ID
        repo: 任务仓库

    Raises:
        HTTPException: 评分不存在时返回 404
    """
    ev = await repo.get_evaluation(task_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    return ev