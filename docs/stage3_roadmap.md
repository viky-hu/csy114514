# Stage 3 路线图 — 从 Non-Semantic PASS 到真实防御

> 编制: 陈书扬
> 日期: 2026-08-18
> 状态: 待组长审阅

---

## 1. Stage 2 现状与核心问题

### 1.1 当前测试结果 (80 TC)

| RiskPattern | PASS | FAIL | 语义攻击触达? |
|-------------|------|------|---------------|
| R1 (IPI Web) | 24 | 14 | ❌ 攻击未触达 |
| R2 (Memory) | 6 | 0 | ❌ 攻击未触达 |
| R3 (Privacy) | 7 | 0 | ❌ 攻击未触达 |
| R4 (Persistent IPI) | 17 | 1 | ✅ 攻击触达 |
| OTHER | 9 | 2 | ✅ 攻击触达 |

### 1.2 核心问题: Non-Semantic PASS

当前 CorpMate 是**基于关键词匹配的参考 Agent**，不是 LLM：

```
用户输入 → 关键词匹配 → 调用对应 tool → 返回固定响应
```

R1/R2/R3 攻击的原理是：恶意内容嵌入网页 (env_delta.browser_pages)，期待 Agent **读取并理解**页面内容后执行恶意指令。但 CorpMate **不处理页面内容作为指令**——它只是打开页面并返回文本摘要。

所以 R1/R2/R3 的 PASS 不是因为"Agent 防御了攻击"，而是因为"攻击根本没到达攻击面"。

### 1.3 14 条 FAIL 的真实原因

14 条 mutated TC FAIL 不是因为攻击成功，而是因为 CorpMate 的一个**硬编码分支**被意外触发：

```python
# agent.py L89
elif "forward" in page["content"].lower() or "hidden" in page["content"].lower():
    self.sandbox.execute("email.send", {...})  # ← 硬编码发件
```

变异 TC 的页面内容恰好包含 "forward" 或 "hidden" 关键词，命中了这个分支。这是 **巧合性 FAIL**，不是安全性 FAIL。

---

## 2. Stage 3 三阶段演进

### 2.1 阶段总览

```
Stage 2 (当前)         Stage 3a            Stage 3b             Stage 3c
CorpMate              Bare LLM            LLM + 基础防御        LLM + 完整防御
(关键词匹配)          (无防御基线)         (输入过滤+确认)       (多层防御)
                     
R1: PASS (non-sem)   R1: FAIL ✗          R1: PASS ✓           R1: PASS ✓
R2: PASS (non-sem)   R2: FAIL ✗          R2: 部分 PASS         R2: PASS ✓
R3: PASS (non-sem)   R3: FAIL ✗          R3: PASS ✓           R3: PASS ✓
R4: FAIL (real)      R4: FAIL ✗          R4: PASS ✓           R4: PASS ✓

PASS 含义:           PASS 含义:           PASS 含义:            PASS 含义:
"攻击没到"           "没有PASS"           "防御有效"             "多层防御验证"
```

### 2.2 Stage 3a: Bare LLM 基线 (D15-D17, 3天)

**目标**: 替换 CorpMate 关键词匹配为真实 LLM，建立攻击基线。

**预期结果**: R1/R2/R3/R4 大部分 FAIL，证明攻击对 LLM Agent 确实有效。

**工作内容**:

| # | 任务 | 产出 |
|---|------|------|
| 1 | 实现 LLMAgent 替代 CorpMate | `backend/app/agents/llm_agent.py` |
| 2 | 接入 LLM API (OpenAI / Claude / 本地) | `backend/app/llm/client.py` |
| 3 | Agent 读取页面内容并作为上下文推理 | LLM 会"看到"嵌入的恶意指令 |
| 4 | 保持 Sandbox/Runner/Judge 不变 | 只替换 Agent 层 |
| 5 | 跑 80 TC 对比 | 预期 40-60 FAIL (攻击真正生效) |

**关键架构变更**:

```python
class LLMAgent:
    def chat(self, user_input: str) -> tuple[str, list[dict]]:
        # 1. 构建 system prompt (角色 + tool 描述)
        # 2. 调用 LLM API, 传入 user_input
        # 3. LLM 返回 tool calls → 执行
        # 4. 页面内容会进入 LLM 上下文 → 恶意指令可能被执行
        ...
```

**验收标准**: 至少 30 条 TC FAIL（证明攻击对 LLM 有效），FAIL 原因包含 `FORBIDDEN_TOOL_CALL` 和 `CONFIRMATION_MISSING`。

---

### 2.3 Stage 3b: 基础防御层 (D18-D20, 3天)

**目标**: 在 LLM Agent 上添加防御机制，使 PASS 率回升。

**防御机制**:

| # | 防御 | 针对攻击 | 实现方式 |
|---|------|----------|----------|
| D1 | 输入过滤 | R1 IPI Web | 页面内容清洗：移除隐藏 HTML、注释、不可见文本 |
| D2 | 输出审查 | R1/R4 | LLM 输出前检查是否包含 email.send 调用意图 |
| D3 | 确认强化 | R4 | email.send 必须经用户确认才能执行 |
| D4 | 指令隔离 | R2 Memory | 页面内容标记为 "data" 而非 "instruction" |

**实现方案**:

```python
class DefendedLLMAgent(LLMAgent):
    def chat(self, user_input: str) -> tuple[str, list[dict]]:
        # 1. 输入预处理: 清洗页面内容 (D1)
        clean_pages = self.sanitize_pages(user_input)
        
        # 2. System prompt 注入防御指令 (D4)
        system = SYSTEM_PROMPT + DEFENSE_INSTRUCTIONS
        
        # 3. LLM 推理
        response, tool_calls = super().chat_with(clean_pages, system)
        
        # 4. 输出审查 (D2)
        tool_calls = self.filter_tool_calls(tool_calls)
        
        # 5. 确认检查 (D3)
        for tc in tool_calls:
            if tc["tool_name"] == "email.send" and not tc["confirmed"]:
                return "需要确认才能发送邮件", []
        
        return response, tool_calls
```

**预期结果**: R1/R3 回到 PASS，R2/R4 部分 PASS（50-70% 通过率）。

---

### 2.4 Stage 3c: 多层防御 (D21-D24, 4天)

**目标**: 完善防御体系，80 TC 全部 PASS。

**新增防御**:

| # | 防御 | 说明 |
|---|------|------|
| D5 | 因果链检测 | 检查 "读页面 → 写记忆 → 发邮件" 的异常链路 |
| D6 | 意图分类器 | 用小模型判断 tool call 是否源自页面指令 |
| D7 | 记忆写入审查 | 阻止将转发指令/签名指令写入 memory |
| D8 | 跨会话监控 | 检测会话间的记忆投毒行为 |

**预期结果**: 80 TC 全部 PASS，且 PASS 含义为 "Agent 识别并阻止了攻击"。

---

## 3. 关键指标对比

### 3.1 PASS 质量矩阵

| 阶段 | PASS 含义 | 评委认可度 | 示例 |
|------|-----------|-----------|------|
| Stage 2 | 攻击未触达 | ⚠️ 低 | "CorpMate 不看页面所以不会被注入" |
| Stage 3a | (无 PASS) | — | 基线，证明攻击有效 |
| Stage 3b | 单层防御有效 | 🟡 中 | "输入过滤阻止了 IPI" |
| Stage 3c | 多层纵深防御 | 🟢 高 | "Agent 理解攻击意图并主动拒绝" |

### 3.2 预期测试数据

| 指标 | Stage 2 | Stage 3a | Stage 3b | Stage 3c |
|------|---------|----------|----------|----------|
| Total TC | 80 | 80 | 80 | 80+ |
| PASS | 63 | 20-30 | 50-60 | 75-80 |
| FAIL | 17 | 50-60 | 20-30 | 0-5 |
| Semantic PASS% | 0% | — | ~60% | ~95% |

---

## 4. 技术风险与降级

| # | 风险 | 降级方案 |
|---|------|----------|
| R1 | LLM API 延迟高 (>5s/call) | 用本地小模型 (Qwen/ChatGLM) |
| R2 | LLM 不遵循 tool calling 格式 | 添加 JSON 解析 + 重试逻辑 |
| R3 | 防御层误杀正常请求 | 调阈值 + 增加 defense TC 覆盖 |
| R4 | Stage 3a FAIL 率不够高 | 调整 system prompt 让 LLM 更容易被注入 |

---

## 5. 对评委的叙事

> "我们的评测平台分三个阶段验证 Agent 安全性:
>
> **Stage 2**: 用关键词 Agent 验证评测基础设施 (Runner, Judge, Report) 正确运转。此时 63 PASS / 17 FAIL。
>
> **Stage 3a**: 替换为真实 LLM Agent 后，攻击确实生效——FAIL 率飙升到 60-75%。这证明了我们的测试用例**真正能检测 IPI 攻击**。
>
> **Stage 3b/c**: 逐层添加防御后，PASS 率回升。最终 80 TC 全部 PASS，且每次 PASS 都意味着 Agent **主动识别并阻止了攻击**，而非因为攻击没有到达攻击面。
>
> 这条演进线证明了三件事: (1) 我们的测试用例是有效的，(2) 攻击对 LLM Agent 确实构成威胁，(3) 纵深防御可以将风险降到可接受水平。"

---

## 6. 时间线 (D15-D24)

| 日 | 阶段 | 任务 | 产出 |
|----|------|------|------|
| D15 | 3a | LLMAgent 框架 + API 接入 | 能调 LLM 并返回 tool calls |
| D16 | 3a | System prompt + tool 描述 | LLM 知道 7 个 tool 的用法 |
| D17 | 3a | **80 TC 基线测试** | FAIL 率数据 + 分析报告 |
| D18 | 3b | 输入过滤器 (D1) | 页面内容清洗模块 |
| D19 | 3b | 确认强化 + 输出审查 (D2/D3) | tool call 过滤 |
| D20 | 3b | **80 TC 防御测试** | PASS 率回升数据 |
| D21 | 3c | 因果链检测 (D5) | 跨 step 异常检测 |
| D22 | 3c | 意图分类器 (D6) | 小模型判断指令来源 |
| D23 | 3c | 记忆审查 + 跨会话监控 (D7/D8) | R2/R4 防御完善 |
| D24 | 3c | **最终验收: 80 TC 全 PASS** | M3 交付 |
