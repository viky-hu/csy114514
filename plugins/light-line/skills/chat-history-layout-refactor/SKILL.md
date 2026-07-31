---
name: chat-history-layout-refactor
description: 交互对话历史记录与坐标驱动布局重构 skill。用于调整 Window 4 信息流、模型配置、历史记录栏和 SVG 画布联动时，将 HTML 覆盖层从硬编码百分比改为 coords.ts 坐标映射。
---

# 历史记录布局重构

## 适用场景

当需要新增历史会话记录功能、改变交互对话页面布局、让信息流和模型配置画布同步移动时使用。

## 目标效果

HTML 覆盖层、SVG 画布和菜单联动都由同一套坐标常量推算，避免聊天区、模型配置区、按钮、气泡、输入框与画布错位。

## 核心做法

- 在 `coords.ts` 中维护画布矩形坐标和映射函数。
- 用 `svgToCssPx(containerW, containerH, coords)` 将 SVG viewBox 坐标换算成 CSS 像素。
- 用 `svgShiftPx(containerW, containerH, fromCoords, toCoords)` 替代 `-15vw` 等魔法值。
- 用 `ResizeObserver` 监听容器尺寸，写入 CSS 变量。
- CSS 使用变量定位，GSAP 使用同源计算位移。

## 关键文件

- 主责：`app/windows/shared/coords.ts`、`ChatInteractionPanel.tsx`、`window-3-main.css`。
- 协同：`ChatCanvasLines.tsx`、`ModelConfigCanvasLines.tsx`、架构文档。

## 常见错题

### 错题 1：只移动 SVG 背景

错误做法：SVG 背景左移，HTML 里的按钮、气泡、输入框仍按视口硬编码。

正确做法：所有覆盖层都基于同一个画布坐标映射定位。

### 错题 2：百分比和像素混算

错误做法：CSS 里继续混用 `25%`、`calc(25% + 18px)`、`-15vw`。

正确做法：坐标映射只在一个工具层完成，CSS 读取变量。

## 验收标准

- 125% 缩放下信息流与画布对齐。
- 菜单开合时画布、信息流、模型配置同步移动。
- 新增历史记录栏时只需调整坐标常量，不散改组件。
- `shared` 工具保持纯函数和可复用。
