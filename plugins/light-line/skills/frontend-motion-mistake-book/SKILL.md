---
name: frontend-motion-mistake-book
description: 本项目动效 AI 易错点错题本。用于编写或调整 GSAP、SVG、Canvas、Three.js、Rive、vis-network 动效时，防止卡顿、重建时间轴、图层穿透和动画干扰交互。
---

# 动效错题本

## 动效分工

- GSAP：窗口转场、SVG 线条绘制、聊天气泡、FLIP、菜单联动、输入框位移动画。
- Rive：导航、图标、品牌展示等设计师驱动动效。
- Three.js/WebGL：Beams、Hyperspeed、Threads 等背景或氛围层。
- Canvas 2D：DotGrid 点阵、轻量交互背景。
- vis-network：知识图谱物理布局与拖拽缩放。

## 常见错题

### 错题 1：动画属性选错

错误做法：高频动画中反复改 `top`、`left`、`width`、`height`、大面积 `filter`。

正确做法：优先使用 `transform` 和 `opacity`；必须用 `filter` 时，动画结束后清理。

### 错题 2：hover 时全量重建时间轴

错误做法：每次鼠标经过都重新创建整条 GSAP timeline。

正确做法：复用时间轴或只更新上一目标与当前目标；组件卸载时统一 kill 或 revert。

### 错题 3：首屏动画和重模块抢资源

错误做法：登录首屏线条动画播放时，同时初始化大图谱或复杂物理布局。

正确做法：首屏只保留必要轻量动效；重模块按需懒挂载。

### 错题 4：WebGL 背景不礼貌退场

错误做法：登录第二阶段或蓝色面板中背景仍在上方闪动。

正确做法：背景作为氛围层，切换阶段快速淡出并设置不拦截事件。

### 错题 5：知识图谱持续抖动

错误做法：图谱物理引擎一直运行，节点拖动时重启求解。

正确做法：初始稳定化后关闭 stabilization，保持拖拽可用但不持续耗算力。

## 动效质量清单

- 用 `gsap.context()`、`useGSAP` 或等价清理机制管理生命周期。
- 动画结束后清理临时 `filter`、`will-change` 等合成层占用。
- 需要 reduced motion 时保留可读、可用的静态状态。
- 验收至少覆盖 Edge + 125% 缩放。
