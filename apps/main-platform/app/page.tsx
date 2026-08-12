"use client";

import { useState } from "react";
import { LoginIntroWindow } from "./windows/login/LoginIntroWindow";
import { MainWindow } from "./windows/main/MainWindow";
import { DEFAULT_AGENT_ID } from "./windows/shared/agent-config";

export default function HomePage() {
  const [isMainWindowVisible, setIsMainWindowVisible] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState(DEFAULT_AGENT_ID);

  if (isMainWindowVisible) {
    return <MainWindow initialAgentId={activeAgentId} />;
  }

  return (
    <LoginIntroWindow
      onSignIn={() => undefined}
      onAgentEntryComplete={(agentId) => {
        setActiveAgentId(agentId);
        setIsMainWindowVisible(true);
      }}
    />
  );
}
