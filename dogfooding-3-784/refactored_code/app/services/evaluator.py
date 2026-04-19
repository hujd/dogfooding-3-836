"""评分引擎 - 基于 10 个维度的模型表现评估"""
from __future__ import annotations

import json
import logging

from ..models import Dimension, TaskResponse, EvaluationResult
from .llm_client import call_llm

logger = logging.getLogger(__name__)

_EVAL_SYSTEM = (
    "你是一位专业的 AI 模型评测专家。\n"
    "你需要根据 10 个维度对大模型在代码分析任务上的表现进行客观评分。\n"
    "评分标准（5 分制）：\n"
    "- 5 分：完全正确，深入透彻，有洞察力\n"
    "- 4 分：基本正确，覆盖主要方面\n"
    "- 3 分：部分正确，有遗漏或小错\n"
    "- 2 分：方向对但有明显错误\n"
    "- 1 分：基本不正确或答非所问\n\n"
    "你必须严格按照 JSON 格式输出，不要输出其他任何内容。"
)

_EVAL_TEMPLATE = """请评估以下模型在代码分析任务上的表现：

## 任务描述
{task_description}

## 被测模型输出
{model_response}

## 参考标准（如有）
{reference}

## 评测维度（5 分制）

1. **用户体验满意度** - 推理是否流畅，有无冗余自纠
2. **规划&执行反馈** - 是否有任务拆解、todo、状态更新
3. **理解/推理能力** - 是否准确理解代码和指令
4. **指令遵循** - 是否遵循所有约束条件
5. **工程完备度** - 是否主动补充测试
6. **交付完整性** - 代码是否可运行，需求是否全部实现
7. **边界感** - 是否遵守架构规范，不越界修改
8. **前端 3D 产物** - 如不涉及请标记 null
9. **前端产物美观度** - 如不涉及请标记 null
10. **长程任务** - 是否能自主完成多步骤任务

## 问题类型检测
- Hallucination（幻觉）：是否编造不存在的 API 或事实
- Context Loss（上下文丢失）：是否遗漏关键信息
- Instruction Failure（指令失败）：是否未按格式输出
- Infinite Loop（死循环）：是否陷入重复

请输出 JSON 格式的评分报告：
{{
  "scores": {{
    "user_experience": {{"score": <1-5>, "comment": "简评"}},
    "planning_execution": {{"score": <1-5>, "comment": ""}},
    "understanding_reasoning": {{"score": <1-5>, "comment": ""}},
    "instruction_following": {{"score": <1-5>, "comment": ""}},
    "engineering_completeness": {{"score": <1-5>, "comment": ""}},
    "delivery_integrity": {{"score": <1-5>, "comment": ""}},
    "boundary_awareness": {{"score": <1-5>, "comment": ""}},
    "frontend_3d": {{"score": null, "comment": "本任务不涉及"}},
    "frontend_aesthetics": {{"score": null, "comment": "本任务不涉及"}},
    "long_range_task": {{"score": <1-5>, "comment": ""}}
  }},
  "summary": {{
    "total_score": <总分>,
    "avg_score": <平均分>,
    "level": "<A/B/C/D>",
    "strengths": ["优势 1", "优势 2"],
    "weaknesses": ["不足 1", "不足 2"],
    "overall_comment": "整体评价和改进建议"
  }},
  "issue_types": {{
    "hallucination": <true/false>,
    "context_loss": <true/false>,
    "instruction_failure": <true/false>,
    "infinite_loop": <true/false>
  }}
}}"""


def _parse_eval_response(raw: str) -> dict:
    """解析评分模型的 JSON 响应

    Args:
        raw: 原始响应文本

    Returns:
        解析后的字典

    Raises:
        json.JSONDecodeError: 解析失败
    """
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
        cleaned = cleaned.rsplit("```", 1)[0]
    cleaned = cleaned.strip()
    return json.loads(cleaned)


def _create_fallback_result(raw: str) -> dict:
    """创建解析失败时的回退结果"""
    logger.warning(f"评分解析失败，使用回退结果。原始响应: {raw[:200]}")
    return {
        "scores": {
            "user_experience": {"score": 3, "comment": "评分解析失败"},
            "planning_execution": {"score": 3, "comment": ""},
            "understanding_reasoning": {"score": 3, "comment": ""},
            "instruction_following": {"score": 3, "comment": ""},
            "engineering_completeness": {"score": 3, "comment": ""},
            "delivery_integrity": {"score": 3, "comment": ""},
            "boundary_awareness": {"score": 3, "comment": ""},
            "long_range_task": {"score": 3, "comment": ""},
        },
        "summary": {
            "total_score": 24,
            "avg_score": 3.0,
            "level": "C",
            "strengths": [],
            "weaknesses": ["评分模型返回格式异常"],
            "overall_comment": raw[:200],
        },
        "issue_types": {
            "hallucination": False,
            "context_loss": False,
            "instruction_failure": True,
            "infinite_loop": False,
        },
    }


def _calculate_average_score(scores: dict) -> float:
    """计算有效分数的平均值

    Args:
        scores: 分数字典

    Returns:
        平均分
    """
    valid_scores = [
        v.get("score")
        for v in scores.values()
        if isinstance(v, dict) and v.get("score") is not None
    ]
    return sum(valid_scores) / len(valid_scores) if valid_scores else 0.0


def _collect_issues(scores: dict) -> tuple[list[str], list[str]]:
    """收集问题和问题类型

    Args:
        scores: 分数字典

    Returns:
        (issues 列表, issue_types 列表)
    """
    issues = []
    issue_types = []

    # 从评分评论中收集问题
    for dim, score_data in scores.items():
        if isinstance(score_data, dict):
            comment = score_data.get("comment", "")
            # 修复：添加括号确保正确的运算符优先级
            if comment and ("失败" in comment or "异常" in comment):
                issues.append(f"{dim}: {comment}")

    return issues, issue_types


def _extract_issue_types(data: dict) -> list[str]:
    """从响应数据中提取问题类型"""
    issue_types = []
    it = data.get("issue_types", {})

    if it.get("hallucination"):
        issue_types.append("Hallucination")
    if it.get("context_loss"):
        issue_types.append("Context Loss")
    if it.get("instruction_failure"):
        issue_types.append("Instruction Failure")
    if it.get("infinite_loop"):
        issue_types.append("Infinite Loop")

    return issue_types


async def evaluate_task(
    task: TaskResponse,
    reference_answer: str | None = None,
) -> EvaluationResult:
    """调用大模型对另一个模型的回答进行评分

    Args:
        task: 任务响应对象
        reference_answer: 可选的参考答案

    Returns:
        评分结果
    """
    task_desc = f"代码分析任务 - 维度：{task.dimension.value}"
    reference = reference_answer if reference_answer else "（无参考答案，请根据专业知识评判）"

    user_prompt = _EVAL_TEMPLATE.format(
        task_description=task_desc,
        model_response=task.model_response,
        reference=reference,
    )

    raw = await call_llm(_EVAL_SYSTEM, user_prompt)

    # 解析 JSON
    try:
        data = _parse_eval_response(raw)
    except json.JSONDecodeError:
        data = _create_fallback_result(raw)

    # 构建评分结果
    scores = data.get("scores", {})
    summary = data.get("summary", {})

    avg_score = _calculate_average_score(scores)
    issues, _ = _collect_issues(scores)
    issue_types = _extract_issue_types(data)

    return EvaluationResult(
        task_id=task.task_id,
        dimension=task.dimension,
        score=avg_score,
        breakdown=scores,
        issues=issues,
        issue_types=issue_types,
        summary=summary.get("overall_comment", ""),
    )