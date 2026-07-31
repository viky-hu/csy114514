---
name: frontend-stack-mistake-book
description: 本项目技术栈 AI 易错点错题本。用于在 final 前端项目中选择、解释或改造技术栈时，防止误用 Next.js、React、TypeScript、Tailwind、shadcn ui、GSAP、Rive、Three.js、BFF 与 Python 联邦服务边界。
---

# 技术栈错题本

## 使用方式

在改造 final 前端项目时，先判断改动属于前端展示、前端 BFF、Python 联邦服务还是后端 RAG 子项目。不要把所有问题都塞进 React 组件。

## 必背基线

- 项目是 `pnpm workspaces + Turborepo` 的 Monorepo。
- 主前端是 `apps/main-platform`，使用 `Next.js App Router + React + TypeScript`。
- 样式以 `Tailwind CSS` 与现有 CSS 文件为主，基础组件遵循 `shadcn/ui` 与 Radix 语义。
- 动画分工清晰：GSAP 负责窗口、SVG、时间轴和滚动驱动；Rive 负责设计师制作的图标、导航、品牌动效；Three.js/WebGL 只做背景或复杂视觉层。
- 后端联调默认通过 `app/api/**/route.ts` 做 BFF，前端组件不直接暴露后端地址和密钥。

## 常见错题

### 错题 1：把慢查询或聚合写进组件

错误做法：在 `ChatInteractionPanel.tsx` 里直接请求多个节点、聚合结果、处理密钥。

正确做法：组件调用服务封装，服务封装调用同域 BFF，BFF 再调用 `central_server.py` 或节点服务。

### 错题 2：把 `proxy.ts` 当业务聚合层

错误做法：用 `proxy.ts` 承载慢查询、节点聚合、回答裁决。

正确做法：`proxy.ts` 只做安全头、请求打标、重定向等边界能力；业务聚合放在 Route Handler 与服务层。

### 错题 3：默认新增客户端组件

错误做法：所有组件都加 `"use client"`。

正确做法：只有依赖 GSAP、Canvas、DOM 事件、状态交互的叶子组件使用客户端组件；能用 Server Component 的外层保持静态。

### 错题 4：把后端常驻服务塞进 Next.js 运行时

错误做法：试图让 Next.js 同时常驻多个 Python `uvicorn` 服务。

正确做法：Next.js 前端与 BFF 独立部署，Python 中心和节点服务独立运行，通过环境变量配置受控地址。

### 错题 5：把密钥写成 `NEXT_PUBLIC_*`

错误做法：为了前端能读到，把 SM4 key、内部 token、后端 URL 放进公开变量。

正确做法：敏感配置只在服务端读取，前端只调用同域 `/api/...`。

## 交付检查

- 说明主责文件和协同文件。
- 检查是否符合 Next.js App Router 与 BFF 边界。
- 运行类型检查或说明未运行原因。
- 若模块职责变化，同步架构文档与扩展审查记录。
