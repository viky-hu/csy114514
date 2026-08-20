import "./globals.css";
import "./styles/window-1-login.css";
import "./styles/window-3-main.css";
import "./styles/window-3-evaluation.css";
import "cn-fontsource-ding-talk-jin-bu-ti-regular/font.css";
import "react-easy-crop/react-easy-crop.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "AgentProof | Agent 安全评估平台",
  description: "可观察、可解释、可复现、可修复的 Agent 安全评估平台"
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
