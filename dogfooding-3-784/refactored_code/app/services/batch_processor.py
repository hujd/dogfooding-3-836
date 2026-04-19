"""批量任务处理器 - 支持并发控制"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Optional

from ..models import TestCase, AnalyzeRequest, TaskResponse, TaskStatus, EvaluationResult, Dimension
from .prompt_builder import build_prompt
from .llm_client import call_llm
from .evaluator import evaluate_task
from ..config import settings


@dataclass
class BatchConfig:
    """批处理配置"""
    concurrency: int = 5
    timeout: float = 120.0


@dataclass
class BatchResultItem:
    """单个批处理结果"""
    task: TaskResponse
    evaluation: Optional[EvaluationResult] = None


@dataclass
class BatchStatistics:
    """批处理统计"""
    total_cases: int = 0
    completed: int = 0
    failed: int = 0
    dimension_scores: dict[str, list[float]] = field(default_factory=dict)

    def add_score(self, dimension: Dimension, score: float) -> None:
        """添加分数"""
        dim_key = dimension.value
        if dim_key not in self.dimension_scores:
            self.dimension_scores[dim_key] = []
        self.dimension_scores[dim_key].append(score)

    def get_dimension_averages(self) -> dict[str, float]:
        """获取各维度平均分"""
        return {
            k: sum(v) / len(v) if v else 0.0
            for k, v in self.dimension_scores.items()
        }

    def get_overall_average(self) -> float:
        """获取总体平均分"""
        all_scores = [
            score for scores in self.dimension_scores.values() for score in scores
        ]
        return sum(all_scores) / len(all_scores) if all_scores else 0.0


class BatchProcessor:
    """批量任务处理器"""

    def __init__(self, config: Optional[BatchConfig] = None):
        self.config = config or BatchConfig()

    async def process_cases(
        self,
        cases: list[TestCase],
        model: str,
        progress_callback: Optional[Callable[[int, int], None]] = None,
    ) -> tuple[list[BatchResultItem], BatchStatistics]:
        """处理所有测试用例

        Args:
            cases: 测试用例列表
            model: 使用的模型
            progress_callback: 进度回调函数 (current, total)

        Returns:
            (结果列表, 统计信息)
        """
        semaphore = asyncio.Semaphore(self.config.concurrency)
        stats = BatchStatistics(total_cases=len(cases))

        async def process_with_limit(case: TestCase, index: int) -> BatchResultItem:
            """带并发限制的处理"""
            async with semaphore:
                result = await self._process_single(case, model, stats)
                if progress_callback:
                    progress_callback(index + 1, len(cases))
                return result

        # 创建所有任务
        tasks = [
            process_with_limit(case, i) for i, case in enumerate(cases)
        ]

        # 并发执行
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 处理异常结果
        processed_results: list[BatchResultItem] = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                # 创建失败的任务记录
                failed_task = TaskResponse(
                    dimension=cases[i].dimension,
                    code=cases[i].code,
                    language=cases[i].language,
                    model_used=model,
                    prompt_sent="",
                    status=TaskStatus.FAILED,
                    error=str(result),
                )
                processed_results.append(BatchResultItem(task=failed_task))
                stats.failed += 1
            else:
                processed_results.append(result)

        return processed_results, stats

    async def _process_single(
        self, case: TestCase, model: str, stats: BatchStatistics
    ) -> BatchResultItem:
        """处理单个用例

        Args:
            case: 测试用例
            model: 模型名称
            stats: 统计对象（会被修改）

        Returns:
            批处理结果项
        """
        # 构建请求和提示词
        analyze_req = self._build_request(case, model)
        system_prompt, user_prompt = build_prompt(analyze_req)

        # 创建任务（初始状态为运行中）
        task = self._create_task(case, model, user_prompt)

        try:
            # 调用 LLM
            response = await call_llm(system_prompt, user_prompt, model=model)
            task = self._update_task_success(task, response)

            # 评分
            evaluation = await evaluate_task(task)
            stats.add_score(case.dimension, evaluation.score)
            stats.completed += 1

            return BatchResultItem(task=task, evaluation=evaluation)

        except Exception as e:
            task = self._update_task_failure(task, str(e))
            stats.failed += 1
            return BatchResultItem(task=task)

    def _build_request(self, case: TestCase, model: str) -> AnalyzeRequest:
        """构建分析请求"""
        return AnalyzeRequest(
            code=case.code,
            language=case.language,
            dimension=case.dimension,
            input_data=case.input_data,
            target_language=case.target_language,
            model=model,
        )

    def _create_task(self, case: TestCase, model: str, prompt: str) -> TaskResponse:
        """创建任务响应"""
        return TaskResponse(
            dimension=case.dimension,
            code=case.code,
            language=case.language,
            model_used=model,
            prompt_sent=prompt,
            status=TaskStatus.RUNNING,
        )

    def _update_task_success(self, task: TaskResponse, response: str) -> TaskResponse:
        """更新任务成功状态"""
        task.model_response = response
        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.now(timezone.utc).isoformat()
        return task

    def _update_task_failure(self, task: TaskResponse, error: str) -> TaskResponse:
        """更新任务失败状态"""
        task.status = TaskStatus.FAILED
        task.error = error
        return task