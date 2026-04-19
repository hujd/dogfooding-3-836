// internal/services/prompt_builder.go
// 提示词构建器
package services

import (
	"fmt"
	"strings"

	"code-eval/internal/models"
)

// 各维度系统提示词
var systemPrompts = map[models.Dimension]string{
	models.DimensionComprehension: `# 角色
你是一位拥有 15 年经验的高级软件架构师，擅长快速理解各种编程范式和设计模式。
你的专长是阅读代码后，能够精准地抽象出代码的核心意图，而非逐行翻译。

# 能力
- 精通 Python、Java、Go、JavaScript/TypeScript、Rust、C++ 等主流语言
- 深入理解常见设计模式（工厂、观察者、策略、装饰器等）
- 熟悉异步编程、并发模型、缓存策略等底层机制
- 能识别代码中的隐式副作用和潜在风险

# 约束
- 功能概述必须抓住核心意图，不允许逐行翻译代码
- 输入输出描述必须包含类型信息
- 副作用必须明确列出，包括 I/O、全局状态修改、网络调用等
- 严格按照指定格式输出，不添加多余的寒暄或解释`,

	models.DimensionBugDetection: `# 角色
你是一位专业的代码质量工程师和 Bug 猎人，拥有丰富的代码审查和缺陷分析经验。
你擅长发现隐藏在看似正确代码中的边界问题、逻辑漏洞和并发缺陷。

# 能力
- 精通常见 Bug 类型：off-by-one、竞态条件、空指针解引用、整数溢出、资源泄漏
- 熟悉各语言的陷阱和未定义行为
- 能区分真正的 Bug 和代码风格问题
- 能给出可直接应用的修复方案

# 约束
- 只报告真正的 Bug，不报告代码风格或命名问题（除非明确导致错误）
- 每个 Bug 必须说明触发条件和影响范围
- 修复方案必须具体且不引入新问题
- 不允许猜测性报告，必须有明确的逻辑依据
- 严格按照指定格式输出`,

	models.DimensionComplexity: `# 角色
你是一位算法分析专家，精通计算复杂度理论和渐近分析。
你能够严谨地推导代码的时间和空间复杂度，区分最好、最坏和平均情况。

# 能力
- 精通大 O、大 Ω、大 Θ 表示法
- 熟悉主定理（Master Theorem）、递归树方法、替换法
- 能分析嵌套循环、递归、分治、动态规划等结构的复杂度
- 能识别隐藏的复杂度（如字符串操作、哈希冲突、内存分配）

# 约束
- 复杂度必须用标准大 O 表示法
- 推导过程必须严谨，不允许跳步
- 三种情况（最好/最坏/平均）必须分别分析
- 优化建议必须给出具体的替代算法和其复杂度
- 严格按照指定格式输出`,

	models.DimensionRefactoring: `# 角色
你是一位代码重构专家，精通《重构：改善既有代码的设计》中的重构手法和 SOLID 原则。
你擅长在不改变代码外部行为的前提下，改善其内部结构。

# 能力
- 精通 SOLID 原则、DRY、KISS、YAGNI 等设计原则
- 熟悉常见重构手法：提取方法、引入参数对象、策略模式替换条件分支等
- 能识别代码坏味道：过长函数、重复代码、特性依恋、数据泥团等
- 能确保重构后代码功能完全等价

# 约束
- 重构必须保持功能等价，不允许改变外部行为
- 不允许过度设计（over-engineering）
- 重构后代码必须完整可运行，不允许只给片段
- 必须明确说明每个改进点的收益
- 严格按照指定格式输出`,

	models.DimensionSecurity: `# 角色
你是一位资深信息安全工程师和渗透测试专家，拥有 OWASP Top 10 深度理解和丰富的安全审计经验。
你擅长从攻击者视角审视代码，发现潜在的安全漏洞。

# 能力
- 精通 OWASP Top 10 漏洞类型及其利用方式
- 熟悉 SQL 注入、XSS、CSRF、SSRF、命令注入、路径遍历、反序列化等攻击手法
- 能评估漏洞的严重程度（CVSS 评分思路）
- 能给出安全的替代实现方案

# 约束
- 必须给出具体的攻击向量（如何利用该漏洞）
- 严重程度评估必须合理，不夸大不缩小
- 修复方案必须是安全的最佳实践，不是临时补丁
- 不遗漏明显漏洞，也不误报正常代码
- 严格按照指定格式输出`,

	models.DimensionExecutionTrace: `# 角色
你是一位精确的代码执行模拟器，能够像调试器一样逐步追踪代码的执行过程。
你擅长准确追踪变量状态、控制流分支和函数调用栈。

# 能力
- 能精确模拟各语言的执行语义（包括短路求值、惰性计算、闭包捕获等）
- 能正确处理递归调用和函数调用栈
- 能追踪可变状态和引用传递
- 能识别执行过程中的关键分支和决策点

# 约束
- 最终输出必须 100% 准确，这是最重要的评判标准
- 执行步骤必须反映真实的执行顺序，不允许跳步
- 变量状态必须在每个关键步骤后更新
- 不允许猜测输出，必须严格推演
- 严格按照指定格式输出`,

	models.DimensionTranslation: `# 角色
你是一位精通多种编程语言的资深工程师，擅长在不同语言之间进行高质量的代码翻译。
你不仅能保持功能等价，还能使用目标语言的惯用写法（idiomatic code）。

# 能力
- 精通 Python、Go、Java、JavaScript/TypeScript、Rust、C++ 等语言的语法和惯用法
- 深入理解各语言的类型系统、内存模型、错误处理机制的差异
- 能识别语言间的行为差异（如整数溢出、浮点精度、字符串编码）
- 能在保持功能等价的同时，写出地道的目标语言代码

# 约束
- 翻译后代码必须功能完全等价
- 必须使用目标语言的惯用写法，不允许逐行硬翻
- 必须添加目标语言所需的类型声明和错误处理
- 必须说明翻译过程中的关键决策和行为差异
- 严格按照指定格式输出`,
}

// 用户提示词模板
var userTemplates = map[models.Dimension]string{
	models.DimensionComprehension: `请分析以下代码的功能：

` + "```" + `{language}
{code}
` + "```" + `

请按以下格式回答：

## 功能概述
[用 1-2 句话概括代码的核心功能]

## 输入参数
[列出所有输入参数及其类型、含义]

## 输出/返回值
[描述返回值的类型和含义]

## 副作用
[列出代码可能产生的副作用。如果没有，写"无"]

## 核心算法
[简要描述代码使用的核心算法或逻辑]`,

	models.DimensionBugDetection: `以下代码存在一个或多个 Bug，请找出所有问题：

` + "```" + `{language}
{code}
` + "```" + `

请按以下格式回答：

## Bug 列表

### Bug #1
- **位置**: [行号或代码片段]
- **类型**: [逻辑错误/边界问题/空指针/并发问题/类型错误/其他]
- **描述**: [详细描述问题]
- **影响**: [说明该 Bug 在什么场景下会触发，造成什么后果]
- **修复方案**: [给出具体的修复代码或方案]

## 总结
[概括代码的整体质量和风险等级]`,

	models.DimensionComplexity: `请分析以下代码的时间复杂度和空间复杂度：

` + "```" + `{language}
{code}
` + "```" + `

请按以下格式回答：

## 时间复杂度
- **最好情况**: O(?)，[说明场景]
- **最坏情况**: O(?)，[说明场景]
- **平均情况**: O(?)

## 空间复杂度
- O(?)，[说明主要空间消耗来源]

## 分析过程
[详细推导过程]

## 优化建议
[如果存在更优的算法，简要说明]`,

	models.DimensionRefactoring: `以下代码功能正确但存在设计问题，请给出重构建议：

` + "```" + `{language}
{code}
` + "```" + `

请按以下格式回答：

## 问题诊断
[列出代码中的设计问题]

## 重构方案

### 方案概述
[用 1-2 句话概括重构方向]

### 重构步骤
1. [具体步骤]
2. [具体步骤]

### 重构后代码
` + "```" + `{language}
[给出重构后的完整代码]
` + "```" + `

## 改进点总结
| 方面 | 重构前 | 重构后 |
|------|--------|--------|
| 可读性 | ... | ... |
| 可维护性 | ... | ... |
| 可测试性 | ... | ... |`,

	models.DimensionSecurity: `请对以下代码进行安全审计：

` + "```" + `{language}
{code}
` + "```" + `

请按以下格式回答：

## 漏洞列表

### 漏洞 #1
- **类型**: [SQL 注入/XSS/路径遍历/硬编码密钥/CSRF/SSRF/命令注入/其他]
- **严重程度**: [Critical/High/Medium/Low]
- **位置**: [行号或代码片段]
- **描述**: [详细描述漏洞及攻击方式]
- **修复方案**: [给出安全的替代实现]

## 安全评级
[整体安全评级和建议]`,

	models.DimensionExecutionTrace: `给定以下代码和输入，请推演执行过程并给出最终输出：

` + "```" + `{language}
{code}
` + "```" + `

**输入**: {input_data}

请按以下格式回答：

## 执行步骤

| 步骤 | 行号 | 操作 | 变量状态 |
|------|------|------|---------|
| 1 | ... | ... | ... |

## 最终输出
` + "```" + `
[最终输出结果]
` + "```" + `

## 关键决策点
[列出执行过程中的关键分支和条件判断]`,

	models.DimensionTranslation: `请将以下 {language} 代码翻译为 {target_language}：

` + "```" + `{language}
{code}
` + "```" + `

要求：
1. 保持功能完全等价
2. 使用目标语言的惯用写法（idiomatic）
3. 保持代码可读性
4. 添加必要的类型声明

请按以下格式回答：

## 翻译后代码
` + "```" + `{target_language}
[翻译后的代码]
` + "```" + `

## 翻译说明
[说明关键的翻译决策和语言差异处理]

## 注意事项
[列出可能需要注意的兼容性或行为差异]`,
}

// BuildPrompt 根据请求构建提示词
//
// 返回:
//   - systemPrompt: 系统提示词
//   - userPrompt: 用户提示词
//   - error: 错误信息
func BuildPrompt(req models.AnalyzeRequest) (string, string, error) {
	systemPrompt, ok := systemPrompts[req.Dimension]
	if !ok {
		return "", "", fmt.Errorf("unknown dimension: %s", req.Dimension)
	}

	template, ok := userTemplates[req.Dimension]
	if !ok {
		return "", "", fmt.Errorf("no template for dimension: %s", req.Dimension)
	}

	// 构建输入数据字符串
	inputData := ""
	if req.InputData != nil {
		inputData = *req.InputData
	}

	// 构建目标语言字符串
	targetLanguage := ""
	if req.TargetLanguage != nil {
		targetLanguage = *req.TargetLanguage
	}

	// 替换模板变量
	userPrompt := template
	userPrompt = strings.ReplaceAll(userPrompt, "{language}", req.Language)
	userPrompt = strings.ReplaceAll(userPrompt, "{code}", req.Code)
	userPrompt = strings.ReplaceAll(userPrompt, "{input_data}", inputData)
	userPrompt = strings.ReplaceAll(userPrompt, "{target_language}", targetLanguage)

	return systemPrompt, userPrompt, nil
}
