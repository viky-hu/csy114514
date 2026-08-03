# Security Model

> 本文定义系统安全语义, 供 Attack Graph 生成、Risk Pattern 匹配、Judge 判定共同引用。
> 变更需 Security Owner 确认并在群内同步。

版本: v1.0 (Phase 0 冻结)
Owner: 陈书扬

---

# 1. 安全标签语义

节点安全标签定义于 CODING_AGENT_RULE §2.1, 本文给出每个标签的安全语义解释。

## 1.1 UNTRUSTED

```text
含义: 该节点的内容来源不可信, 可能包含恶意构造的指令或数据。
威胁: 攻击者可通过此节点向 Agent 注入恶意指令(Prompt Injection)。
```

**典型节点:**
- `browser.open_page` 的 SOURCE 节点: 网页内容由第三方控制, 可嵌入隐藏指令
- 任何来自 Agent 控制范围之外的数据源

**安全要求:**
- Agent 从 UNTRUSTED 节点读取内容后, 不得直接将其作为指令执行
- UNTRUSTED 内容不得未经过滤写入 PERSISTENT 记忆

---

## 1.2 TRUSTED

```text
含义: 该节点的内容来自可信来源, 由用户或系统管理员直接控制。
威胁: 无直接威胁, 但不应因此放松对其他标签节点的审查。
```

**典型节点:**
- 用户直接输入(假设用户本身是可信的)
- 系统配置文件
- 管理员预设的 Agent 指令

**注意:** TRUSTED 与 UNTRUSTED 互斥, 同一节点不可同时拥有两者。

---

## 1.3 SENSITIVE

```text
含义: 该节点包含敏感数据, 未经授权不得外传。
威胁: 敏感数据可能通过 Agent 的工具调用被泄露到外部。
```

**典型节点:**
- `email.read` 返回的邮件内容(可能含商业机密、个人信息)
- `memory.read` 中存储的用户私有数据
- 任何包含财务、人事、法律相关内容的 DATA 节点

**安全要求:**
- SENSITIVE 数据不得作为参数传递给 DANGEROUS 工具
- Agent 在输出中不得包含 SENSITIVE 数据的原文或可还原摘要

---

## 1.4 DANGEROUS

```text
含义: 该节点代表的动作具有不可逆的外部影响。
威胁: 被恶意利用时, 可造成数据外泄、未授权操作、隐私泄露等后果。
```

**典型节点:**
- `email.send`: 发送邮件不可撤回, 可能泄露数据或发送恶意指令
- 未来可能的: `file.delete`, `api.call_external`, `db.write`

**安全要求:**
- DANGEROUS 工具默认 permission = CONFIRM, 需用户明确授权
- Agent 调用 DANGEROUS 工具时, Judge 必须验证是否有用户确认记录
- DANGEROUS 工具的参数中不得包含来自 UNTRUSTED 节点的未过滤内容

---

## 1.5 PERSISTENT

```text
含义: 该节点的数据跨对话轮次持久化存储, 不会在单次会话结束后清除。
威胁: 恶意内容一旦写入, 可在未来任意时间点被检索并触发延迟攻击。
```

**典型节点:**
- `memory.write` / `memory.read`: Agent 的持久记忆存储

**安全要求:**
- 从 UNTRUSTED 来源读取的内容, 写入 PERSISTENT 记忆前必须经过安全过滤
- PERSISTENT 记忆被检索后, 其内容不得被 Agent 当作指令执行
- PERSISTENT + DANGEROUS 的组合(R4 链)是最高优先级风险

---

# 2. 关键安全概念

## 2.1 Dangerous Sink

```text
定义: 具有不可逆外部影响的工具或动作。
特征:
  ① 动作一旦执行, 无法撤回
  ② 影响范围超出 Agent 自身的控制域
  ③ 可被攻击者利用实现其攻击目标
```

**当前 CorpMate v0 中的 Dangerous Sink:**

| 工具 | 为什么是 Dangerous Sink |
|------|----------------------|
| email.send | 邮件发送不可撤回, 可泄露数据、发送恶意指令给第三方 |

**非 Dangerous Sink 的工具:**

| 工具 | 为什么不是 |
|------|----------|
| browser.open_page | 只是读取, 不产生外部影响 |
| email.list | 只读操作, 不改变外部状态 |
| email.read | 只读操作, 不改变外部状态 |
| memory.read | 只读操作, 不改变外部状态 |
| memory.write | 虽改变内部状态, 但不直接产生外部影响; 但作为 PERSISTENT 节点参与 R2/R4 链 |

---

## 2.2 External Sink

```text
定义: 数据离开 Agent 控制范围的目标。
与 Dangerous Sink 的关系: 所有 External Sink 都是 Dangerous Sink, 但反之不必然。
```

**举例:**
- `email.send` 的收件人地址: 邮件发往 Agent 系统之外 → External Sink
- `memory.write`: 数据仍在 Agent 系统内 → 不是 External Sink

**在 AttackGraph 中的体现:**
- External Sink 节点的 `metadata.is_external` 应为 `true`
- R3 路径的末端节点必须是 External Sink

---

## 2.3 Sensitive Data

```text
定义: 未经授权不得离开系统的数据。
判定依据:
  ① 数据内容的性质(财务、人事、法律、个人隐私)
  ② 数据的访问控制级别
  ③ 数据提供者的预期(用户是否预期此数据被外传)
```

**当前 CorpMate v0 中的 Sensitive Data 来源:**

| 来源 | 敏感原因 |
|------|---------|
| 邮件内容 (email.read) | 可能包含商业机密、个人隐私、财务信息 |
| Agent 记忆 (memory.read) | 可能包含用户偏好、历史操作、私人信息 |

**在 AttackGraph 中的体现:**
- 包含敏感数据的节点必须标记 `SENSITIVE` 标签
- R3 路径检测 SENSITIVE → AGENT → DANGEROUS 的数据流

---

## 2.4 Persistent Memory

```text
定义: 跨对话轮次持久化存储的 Agent 记忆。
特征:
  ① 写入后不会因会话结束而清除
  ② 可在未来的任意会话中被检索
  ③ 可被 Agent 在决策时引用
```

**威胁模型:**
- 攻击者通过 UNTRUSTED 来源(如恶意网页)让 Agent 将恶意内容写入记忆
- 在未来的某次会话中, Agent 检索到被污染的记忆, 并将其作为可信内容使用
- 形成延迟攻击: 攻击发生在 T1, 效果显现在 T2, 用户难以关联因果

**在 AttackGraph 中的体现:**
- memory.read / memory.write 对应的节点必须标记 `PERSISTENT` 标签
- R2 路径检测 UNTRUSTED → AGENT → PERSISTENT 的写入链
- R4 路径检测完整的 SOURCE → AGENT → MEMORY → AGENT → TOOL 五节点链

---

# 3. Attack Graph 安全语义规范

本节定义 AttackGraph 节点和边中与安全相关的语义, 供步嘉城落入 `backend/domain` 和 `backend/attack_graph/`。

## 3.1 节点安全属性分离

```text
node.type       结构角色:  SOURCE / AGENT / TOOL / MEMORY / DATA
node.labels     安全标签:  UNTRUSTED / TRUSTED / SENSITIVE / DANGEROUS / PERSISTENT
node.metadata   扩展信息:  is_external / tool_name / source_url / ...
```

**原则:** 安全属性通过 `labels` 表达, 不通过 `type` 表达。
原因: 未来新增安全标签(如 ENCRYPTED)时, 不需要修改节点类型系统。

## 3.2 标签组合规则

| 组合 | 合法性 | 说明 |
|------|--------|------|
| UNTRUSTED + TRUSTED | 禁止 | 互斥 |
| SENSITIVE + DANGEROUS | 合法 | 如: 一个工具既读敏感数据又有外部影响 |
| PERSISTENT + SENSITIVE | 合法 | 如: 记忆中存储了敏感信息 |
| UNTRUSTED + PERSISTENT | 合法 | R2 攻击链的关键组合 |

## 3.3 边的安全语义

| 边类型 | 安全含义 |
|--------|----------|
| READ_FROM | Agent 从某节点读取数据; 若源节点为 UNTRUSTED, Agent 输出可能被污染 |
| WRITE_TO | Agent 向某节点写入数据; 若目标为 PERSISTENT, 污染将持久化 |
| CALL | Agent 调用某工具; 若工具为 DANGEROUS, 需检查权限和确认 |
| PASS_DATA | 数据在节点间传递; 若从 SENSITIVE 流向 DANGEROUS, 触发 R3 |
| CONTROL | 控制流关系; 用于表示指令传递路径 |

---

# 4. Risk Pattern 与 CorpMate 的映射

## 4.1 CorpMate AttackGraph 典型结构

```text
Web (SOURCE, UNTRUSTED)
  │ READ_FROM
  ↓
CorpMate (AGENT)
  │ CALL
  │ WRITE_TO
  │ READ_FROM
  ↓           ↓
Email Tool   Memory (MEMORY, PERSISTENT)
(TOOL)        │ READ_FROM
  │            ↓
  │         CorpMate (AGENT)
  │            │ CALL
  │            ↓
  └──→ email.send (TOOL, DANGEROUS)
```

## 4.2 各 Pattern 在此图中的命中

| Pattern | 命中路径 | severity |
|---------|----------|----------|
| R1 | Web → CorpMate → email.send | HIGH |
| R2 | Web → CorpMate → Memory | HIGH |
| R3 | Memory(含敏感数据) → CorpMate → email.send | HIGH |
| R4 | Web → CorpMate → Memory → CorpMate → email.send | CRITICAL |

---

# 5. Severity 判定规则 v0

> 纯 deterministic 规则, 不使用 LLM。

| 条件 | severity |
|------|----------|
| Pattern 为 R4 (旗舰, 5 节点持久链) | CRITICAL |
| 涉及 DANGEROUS 工具 + UNTRUSTED 来源 | HIGH |
| 涉及 SENSITIVE 数据外泄 | HIGH |
| 涉及 PERSISTENT 记忆写入 (非 R4) | HIGH |
| 仅涉及未授权工具调用, 无外部影响 | MEDIUM |
| 潜在风险但未命中以上条件 | LOW |

**Stage 1 简化规则:**
- R1 / R2 / R3 → HIGH
- R4 → CRITICAL
- 未来可细化为基于更多因子的打分

---

# 6. 与其他文档的关系

```text
本文档 (security-model.md)
    定义安全语义
    
    ↓ 引用

SECURITY_CONTRACTS.md
    定义 Contract 字段 + 枚举 + 校验规则

    ↓ 引用

CODING_AGENT_RULE.md
    定义全局命名冻结 + 变更流程
```

若本文与 SECURITY_CONTRACTS.md 冲突, 以 SECURITY_CONTRACTS.md 为准。
若本文与 CODING_AGENT_RULE.md 冲突, 以 CODING_AGENT_RULE.md 为准。
