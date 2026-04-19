"""批量评测路由 - 重构后版本"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..models import Dimension
from ..services.batch_processor import BatchProcessor, BatchConfig, BatchResultItem
from ..services.test_case_store import get_all_cases, get_cases_by_dimension
from ..config import settings


class BatchRequest(BaseModel):
    """批量评测请求"""
    model: str | None = Field(None, description="指定模型")
    dimensions: list[str] | None = Field(None, description="指定维度（为空则全部）")
    concurrency: int = Field(5, ge=1, le=20, description="并发数")


class BatchResponse(BaseModel):
    """批量评测响应"""
    model_used: str
    total_cases: int
    completed: int
    failed: int
    avg_score: float
    dimension_scores: dict[str, float]
    results: list[BatchResultItem]
    started_at: str
    finished_at: str


router = APIRouter(prefix="/api/v1/batch", tags=["batch"])


def get_batch_processor(req: BatchRequest) -> BatchProcessor:
    """获取批处理器实例"""
    config = BatchConfig(concurrency=req.concurrency)
    return BatchProcessor(config)


@router.post("/run", response_model=BatchResponse)
async def run_batch(
    req: BatchRequest,
):
    """批量运行所有测试用例，自动分析 + 评分

    Args:
        req: 批量评测请求

    Returns:
        批量评测响应
    """
    model = req.model or settings.llm_model
    started_at = datetime.now(timezone.utc).isoformat()

    # 获取测试用例
    if req.dimensions:
        cases = []
        for d in req.dimensions:
            try:
                dim = Dimension(d)
                cases.extend(get_cases_by_dimension(dim))
            except ValueError:
                pass  # 忽略无效维度
    else:
        cases = get_all_cases()

    # 创建处理器并执行
    config = BatchConfig(concurrency=req.concurrency)
    processor = BatchProcessor(config)

    results, stats = await processor.process_cases(cases, model)

    # 构建响应
    dimension_avgs = stats.get_dimension_averages()
    avg_score = stats.get_overall_average()

    return BatchResponse(
        model_used=model,
        total_cases=stats.total_cases,
        completed=stats.completed,
        failed=stats.failed,
        avg_score=round(avg_score, 2),
        dimension_scores={k: round(v, 2) for k, v in dimension_avgs.items()},
        results=results,
        started_at=started_at,
        finished_at=datetime.now(timezone.utc).isoformat(),
    )