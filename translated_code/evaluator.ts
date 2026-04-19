/**
 * 评分引擎 - TypeScript 版本
 * 翻译说明:
 * 1. 使用 TypeScript 类型系统替代 Pydantic
 * 2. 使用接口定义数据结构
 * 3. 正则表达式优化
 * 4. 惯用 async/await 保持一致
 * 5. 使用 Map 替代对象字典
 */

// ============ 类型定义
export enum Dimension {
  COMPREHENSION = "comprehension",
  BUG_DETECTION = "bug_detection",
  COMPLEXITY = "complexity",
  REFACTORING = "refactoring",
  SECURITY = "security",
  EXECUTION_TRACE = "execution_trace",
  TRANSLATION = "translation",
}

export enum TaskStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface TaskResponse {
  task_id: string;
  dimension: Dimension;
  status: TaskStatus;
  code: string;
  language: string;
  model_used: string;
  prompt_sent: string;
  model_response: string;
  created_at: string;
  completed_at?: string;
  error?: string;
}

export interface ScoreItem {
  score: number | null;
  comment: string;
}

export interface EvaluationResult {
  task_id: string;
  dimension: Dimension;
  score: number;
  breakdown: Record<string, ScoreItem>;
  issues: string[];
  issue_types: string[];
  summary: string;
  evaluated_at: string;
}

// ============ 常量定义
const _EVAL_SYSTEM = `你是一位专业的 AI 模型评测专家。
你需要根据 10 个维度对大模型在代码分析任务上的表现进行客观评分。
评分标准（5 分制）：
- 5 分：完全正确，深入透彻，有洞察力
- 4 分：基本正确，覆盖主要方面
- 3 分：部分正确，有遗漏或小错
- 2 分：方向对但有明显错误
- 1 分：基本不正确或答非所问

你必须严格按照 JSON 格式输出，不要输出其他任何内容。`;

const _EVAL_TEMPLATE = `请评估以下模型在代码分析任务上的表现：

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
{
  "scores": {
    "user_experience": {"score": <1-5>, "comment": "简评"},
    "planning_execution": {"score": <1-5>, "comment": ""},
    "understanding_reasoning": {"score": <1-5>, "comment": ""},
    "instruction_following": {"score": <1-5>, "comment": ""},
    "engineering_completeness": {"score": <1-5>, "comment": ""},
    "delivery_integrity": {"score": <1-5>, "comment": ""},
    "boundary_awareness": {"score": <1-5>, "comment": ""},
    "frontend_3d": {"score": null, "comment": "本任务不涉及"},
    "frontend_aesthetics": {"score": null, "comment": "本任务不涉及"},
    "long_range_task": {"score": <1-5>, "comment": ""}
  },
  "summary": {
    "total_score": <总分>,
    "avg_score": <平均分>,
    "level": "<A/B/C/D>",
    "strengths": ["优势 1", "优势 2"],
    "weaknesses": ["不足 1", "不足 2"],
    "overall_comment": "整体评价和改进建议"
  },
  "issue_types": {
    "hallucination": <true/false>,
    "context_loss": <true/false>,
    "instruction_failure": <true/false>,
    "infinite_loop": <true/false>
  }
}`;

const _SCORE_DIMENSIONS = [
  "user_experience",
  "planning_execution",
  "understanding_reasoning",
  "instruction_following",
  "engineering_completeness",
  "delivery_integrity",
  "boundary_awareness",
  "long_range_task",
];

const _ISSUE_TYPE_MAPPING: Record<string, string> = {
  hallucination: "Hallucination",
  context_loss: "Context Loss",
  instruction_failure: "Instruction Failure",
  infinite_loop: "Infinite Loop",
};

// ============ LLM 客户端模拟 (需要实际实现
declare async function callLLM(systemPrompt: string, userPrompt: string): Promise<string>;

// ============ 辅助函数

/**
 * 从 Markdown 代码块中提取 JSON
 * @param content 可能包含 Markdown 代码块的字符串
 * @returns 清理后的 JSON 字符串
 */
function extractJsonFromMarkdown(content: string): string {
  const cleaned = content.trim();
  const pattern = /^```(?:json)?\s*$(.*?)^```\s*$/ms;
  const match = cleaned.match(pattern);
  
  if (match) {
    return match[1].trim();
  }
  
  return cleaned;
}

/**
 * 创建默认评分结果（解析失败时使用）
 */
function createDefaultEvalData(rawResponse: string): any {
  const scores: Record<string, { score: number; comment: string }> = {};
  _SCORE_DIMENSIONS.forEach((dim, index) => {
    scores[dim] = {
      score: 3,
      comment: index === 0 ? "评分解析失败" : "",
    };
  });

  return {
    scores,
    summary: {
      total_score: 24,
      avg_score: 3.0,
      level: "C",
      strengths: [],
      weaknesses: ["评分模型返回格式异常"],
      overall_comment: rawResponse.slice(0, 200),
    },
    issue_types: {
      hallucination: false,
      context_loss: false,
      instruction_failure: true,
      infinite_loop: false,
    },
  };
}

/**
 * 计算有效平均分
 * @param scores 分数字典
 * @returns 平均分，范围 1.0-5.0
 */
function calculateAverageScore(scores: Record<string, any>): number {
  const validScores: number[] = [];
  
  for (const key of Object.values(scores)) {
    if (typeof key === "object" && key !== null) {
      const score = key.score;
      if (score != null && typeof score === "number") {
        validScores.push(score);
      }
    }
  }
  
  if (validScores.length === 0) {
    return 3.0;
  }
  
  const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
  return Math.max(1.0, Math.min(5.0, avg));
}

/**
 * 收集评分中的问题
 */
function collectIssues(scores: Record<string, any>): string[] {
  const issues: string[] = [];
  
  for (const [dim, scoreData] of Object.entries(scores)) {
    if (typeof scoreData === "object" && scoreData !== null) {
      const comment = scoreData.comment || "";
      if (comment && (comment.includes("失败") || comment.includes("异常"))) {
        issues.push(`${dim}: ${comment}`);
      }
    }
  }
  
  return issues;
}

/**
 * 收集问题类型
 */
function collectIssueTypes(issueTypesData: Record<string, boolean>): string[] {
  const issueTypes: string[] = [];
  
  for (const [key, label] of Object.entries(_ISSUE_TYPE_MAPPING)) {
    if (issueTypesData[key]) {
      issueTypes.push(label);
    }
  }
  
  return issueTypes;
}

// ============ 主函数

/**
 * 调用大模型对另一个模型的回答进行评分
 */
export async function evaluateTask(
  task: TaskResponse,
  referenceAnswer?: string,
): Promise<EvaluationResult> {
  const taskDesc = `代码分析任务 - 维度：${task.dimension}`;
  const reference = referenceAnswer || "（无参考答案，请根据专业知识评判）";

  const userPrompt = _EVAL_TEMPLATE
    .replace("{task_description}", taskDesc)
    .replace("{model_response}", task.model_response)
    .replace("{reference}", reference);

  const raw = await callLLM(_EVAL_SYSTEM, userPrompt);

  const cleaned = extractJsonFromMarkdown(raw);

  let data: any;
  try {
    data = JSON.parse(cleaned);
    console.log(`评分解析成功: task_id=${task.task_id}`);
  } catch (e) {
    console.warn(`评分解析失败: task_id=${task.task_id}`);
    data = createDefaultEvalData(raw);
  }

  const scores = data.scores || {};
  const summary = data.summary || {};

  const avgScore = calculateAverageScore(scores);
  const issues = collectIssues(scores);
  const issueTypes = collectIssueTypes(data.issue_types || {});

  return {
    task_id: task.task_id,
    dimension: task.dimension,
    score: avgScore,
    breakdown: scores,
    issues,
    issue_types: issueTypes,
    summary: summary.overall_comment || "",
    evaluated_at: new Date().toISOString(),
  };
}
