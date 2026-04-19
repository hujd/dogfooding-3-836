"""代码分析路由
重构说明:
1. 添加线程安全锁保护全局状态
2. 添加任务自动过期清理
3. 添加请求大小和数量限制
4. 优化列表分页
5. 修复枚举过滤错误
6. 异常分类处理，不泄露敏感信息
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from threading import Lock
import logging
from fastapi import APIRouter, HTTPException, Query

from ..models import AnalyzeRequest, EvaluateRequest, TaskResponse, TaskStatus, EvaluationResult, Dimension
from ..services.prompt_builder import build_prompt
from ..services.llm_client import call_llm
from ..services.evaluator import evaluate_task
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["analyze"])

_MAX_TASKS = 1000
_MAX_CODE_LENGTH = 50000
_TASK_EXPIRE_HOURS = 24

_tasks: dict[str, TaskResponse] = {}
_evaluations: dict[str, EvaluationResult] = {}
_lock = Lock()


def _clean_expired_tasks() -> None:
    """清理过期任务（线程安全"""
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=_TASK_EXPIRE_HOURS)).isoformat()
    expired_ids = []
    
    for task_id, task in _tasks.items():
        if task.completed_at and task.completed_at < cutoff:
            expired_ids.append(task_id)
    
    for task_id in expired_ids:
        del _tasks[task_id]
        _evaluations.pop(task_id, None)
    
    if expired_ids:
        logger.info(f"清理了 {len(expired_ids)} 个过期任务")


def _validate_request(req: AnalyzeRequest) -> None:
    """验证请求参数"""
    if len(req.code) > _MAX_CODE_LENGTH:
        raise HTTPException(
            status_code=413,
            detail=f"代码长度超过限制: 最大 {_MAX_CODE_LENGTH} 字符"
        )


@router.post("/analyze", response_model=TaskResponse)
async def create_analysis(req: AnalyzeRequest):
    """提交代码分析任务"""
    _validate_request(req)
    
    system_prompt, user_prompt = build_prompt(req)
    model = req.model or settings.llm_model

    task = TaskResponse(
        dimension=req.dimension,
        code=req.code,
        language=req.language,
        model_used=model,
        prompt_sent=user_prompt,
        status=TaskStatus.RUNNING,
    )

    try:
        response = await call_llm(system_prompt, user_prompt, model=model)
        task.model_response = response
        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.now(timezone.utc).isoformat()
    except Exception as e:
        task.status = TaskStatus.FAILED
        error_msg = str(e)
        if "api key" in error_msg.lower() or "token" in error_msg.lower():
            task.error = "模型调用认证失败"
        elif "timeout" in error_msg.lower():
            task.error = "模型调用超时"
        else:
            task.error = "模型调用失败，请稍后重试"
        logger.error(f"任务 {task.task_id} 失败: {error_msg}")

    with _lock:
        _clean_expired_tasks()
        if len(_tasks) >= _MAX_TASKS:
            raise HTTPException(status_code=503, detail="任务队列已满，请稍后重试")
        _tasks[task.task_id] = task

    return task


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    """查询任务结果"""
    with _lock:
        task = _tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return task


@router.get("/tasks", response_model=list[TaskResponse])
async def list_tasks(
    dimension: str | None = None,
    status: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """列出所有任务（支持分页和过滤"""
    with _lock:
        results = list(_tasks.values())

    if dimension:
        valid_dimensions = {d.value for d in Dimension}
        if dimension not in valid_dimensions:
            raise HTTPException(status_code=400, detail=f"无效的分析维度")
        results = [t for t in results if t.dimension.value == dimension]

    if status:
        valid_statuses = {s.value for s in TaskStatus}
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"无效的任务状态")
        results = [t for t in results if t.status.value == status]

    results.sort(key=lambda t: t.created_at, reverse=True)
    return results[offset:offset + limit]


@router.post("/evaluate", response_model=EvaluationResult)
async def evaluate(req: EvaluateRequest):
    """对模型返回结果进行评分"""
    with _lock:
        task = _tasks.get(req.task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {req.task_id} not found")
    if task.status != TaskStatus.COMPLETED:
        raise HTTPException(status_code=400, detail=f"Task not completed")

    result = await evaluate_task(task, req.reference_answer)
    with _lock:
        _evaluations[req.task_id] = result
    return result


@router.get("/evaluations/{task_id}", response_model=EvaluationResult)
async def get_evaluation(task_id: str):
    """查询评分结果"""
    with _lock:
        ev = _evaluations.get(task_id)
    if not ev:
        raise HTTPException(status_code=404, detail=f"Evaluation not found")
    return ev
