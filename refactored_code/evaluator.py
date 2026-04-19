"""评分引擎 - 基于 10 个维度的模型表现评估
重构说明:
1. 修复逻辑运算符优先级 Bug
2. 修复 JSON 解析边界处理
3. 修复除零错误和字段约束问题
4. 提取辅助函数分离职责
5. 添加类型安全和边界检查
"""
from __future__ import annotations

import json
import re
import logging
from typing import Any

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

# 默认评分维度列表
_SCORE_DIMENSIONS = [
    "user_experience",
    "planning_execution",
    "understanding_reasoning",
    "instruction_following",
    "engineering_completeness",
    "delivery_integrity",
    "boundary_awareness",
    "long_range_task",
]

_ISSUE_TYPE_MAPPING = {
    "hallucination": "Hallucination",
    "context_loss": "Context Loss",
    "instruction_failure": "Instruction Failure",
    "infinite_loop": "Infinite Loop",
}


def extract_json_from_markdown(content: str) -> str:
    """从 Markdown 代码块中提取 JSON
    参数:
        content: 可能包含 Markdown 代码块的字符串
    返回:
        清理后的 JSON 字符串
    """
    cleaned = content.strip()
    
    # 匹配 ```json ... ``` 或 ``` ... ``` 格式
    pattern = r"^```(?:json)?\s*$(.*?)^```\s*$"
    match = re.search(pattern, cleaned, re.MULTILINE | re.DOTALL)
    
    if match:
        return match.group(1).strip()
    
    # 兼容旧的分割方式，但添加边界检查
    if cleaned.startswith("```"):
        parts = cleaned.split("\n", 1)
        if len(parts) > 1:
            cleaned = parts[1]
            parts = cleaned.rsplit("```", 1)
            if len(parts) > 1:
                cleaned = parts[0].strip()
    
    return cleaned.strip()


def create_default_eval_data(raw_response: str) -> dict[str, Any]:
    """创建默认评分结果（解析失败时使用）
    参数:
        raw_response: 原始 LLM 响应
    返回:
        标准评分数据结构
    """
    return {
        "scores": {
            dim: {"score": 3, "comment": "评分解析失败" if dim == "user_experience" else ""}
            for dim in _SCORE_DIMENSIONS
        },
        "summary": {
            "total_score": 24,
            "avg_score": 3.0,
            "level": "C",
            "strengths": [],
            "weaknesses": ["评分模型返回格式异常"],
            "overall_comment": raw_response[:200] if raw_response else "无响应",
        },
        "issue_types": {
            "hallucination": False,
            "context_loss": False,
            "instruction_failure": True,
            "infinite_loop": False,
        },
    }


def calculate_average_score(scores: dict[str, Any]) -> float:
    """计算有效平均分
    参数:
        scores: 分数字典
    返回:
        平均分，范围 1.0-5.0
    """
    valid_scores = []
    for v in scores.values():
        if isinstance(v, dict):
            score = v.get("score")
            if score is not None and isinstance(score, (int, float)):
                valid_scores.append(float(score))
    
    if not valid_scores:
        return 3.0  # 避免除零，返回中性分数
    
    avg = sum(valid_scores) / len(valid_scores)
    return max(1.0, min(5.0, avg))  # 确保在有效范围内


def collect_issues(scores: dict[str, Any]) -> list[str]:
    """收集评分中的问题
    参数:
        scores: 分数字典
    返回:
        问题列表
    """
    issues = []
    for dim, score_data in scores.items():
        if isinstance(score_data, dict):
            comment = score_data.get("comment", "")
            if comment and ("失败" in comment or "异常" in comment):
                issues.append(f"{dim}: {comment}")
    return issues


def collect_issue_types(issue_types_data: dict[str, Any]) -> list[str]:
    """收集问题类型
    参数:
        issue_types_data: 问题类型字典
    返回:
        问题类型列表
    """
    issue_types = []
    for key, label in _ISSUE_TYPE_MAPPING.items():
        if issue_types_data.get(key, False):
            issue_types.append(label)
    return issue_types


async def evaluate_task(
    task: TaskResponse,
    reference_answer: str | None = None,
) -> EvaluationResult:
    """调用大模型对另一个模型的回答进行评分
    参数:
        task: 分析任务响应
        reference_answer: 参考标准答案（可选）
    返回:
        标准化评分结果
    """
    task_desc = f"代码分析任务 - 维度：{task.dimension.value}"
    reference = reference_answer if reference_answer else "（无参考答案，请根据专业知识评判）"

    user_prompt = _EVAL_TEMPLATE.format(
        task_description=task_desc,
        model_response=task.model_response,
        reference=reference,
    )

    raw = await call_llm(_EVAL_SYSTEM, user_prompt)

    # 解析 JSON（兼容 markdown code block 包裹）
    cleaned = extract_json_from_markdown(raw)

    try:
        data = json.loads(cleaned)
        logger.info(f"评分解析成功: task_id={task.task_id}")
    except json.JSONDecodeError as e:
        logger.warning(f"评分解析失败: task_id={task.task_id}, error={str(e)}")
        data = create_default_eval_data(raw)

    # 构建评分结果
    scores = data.get("scores", {})
    summary = data.get("summary", {})

    avg_score = calculate_average_score(scores)
    issues = collect_issues(scores)
    issue_types = collect_issue_types(data.get("issue_types", {}))

    return EvaluationResult(
        task_id=task.task_id,
        dimension=task.dimension,
        score=avg_score,
        breakdown=scores,
        issues=issues,
        issue_types=issue_types,
        summary=summary.get("overall_comment", ""),
    )
