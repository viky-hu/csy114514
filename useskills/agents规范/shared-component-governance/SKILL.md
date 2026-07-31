---
name: shared-component-governance
description: shared 组件与共享工具治理 skill。用于修改 GlobalTopNav、ProfileModalLong、animation.ts、coords.ts 或新增跨窗口共享能力时，保持纯函数倾向、向后兼容和无窗口特化污染。
---

# 共享组件治理

## 当前共享职责

- `GlobalTopNav.tsx`：全局顶部导航与窗口切换入口。
- `ProfileModalLong.tsx`：个人信息与相关设置弹层。
- `animation.ts`：GSAP 插件注册、共享 easing 与动画工具。
- `coords.ts`：共享坐标、画布矩形和 SVG 到 CSS 的映射工具。

## 开发规则

1. shared 组件禁止直接依赖某单一窗口的私有状态实现。
2. 新增 props 必须保证向后兼容与默认行为稳定。
3. 共享工具函数保持纯函数倾向，避免隐式全局副作用。
4. 新窗口接入应优先通过配置完成，而不是改核心逻辑。

## 常见错题

### 错题 1：共享组件被窗口私有状态污染

错误做法：`shared` 组件内部判断某个窗口的私有 mode 或 conversationId。

正确做法：窗口把必要状态转成通用 props 传入，shared 不知道业务内部细节。

### 错题 2：坐标映射散落

错误做法：CSS 和组件里到处写 `25%`、`-15vw`、`calc(...)`。

正确做法：统一从 `coords.ts` 推算 CSS 变量和 GSAP 位移。

### 错题 3：动画注册重复

错误做法：每个组件各自注册 GSAP 插件，清理策略不一致。

正确做法：共享注册和 easing 放入 `animation.ts`，组件只做具体编排。

## 验收问题

- 新窗口接入是否只需配置。
- shared 是否仍然不知道具体窗口私有状态。
- 类型定义是否覆盖未来新增字段。
- 默认 props 是否保护旧调用点。
