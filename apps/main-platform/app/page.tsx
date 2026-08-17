"use client";

import { useState } from "react";
import { LoginIntroWindow } from "./windows/login/LoginIntroWindow";
import { MainWindow } from "./windows/main/MainWindow";
import { DEFAULT_AGENT_ID } from "./windows/shared/agent-config";

type AccountIdentity = {
  username: string;
  role: string;
  nodeType?: string;
};

export default function HomePage() {
  const [isMainWindowVisible, setIsMainWindowVisible] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState(DEFAULT_AGENT_ID);
  const [accountIdentity, setAccountIdentity] = useState<AccountIdentity | null>(null);

  if (isMainWindowVisible) {
    return (
      <MainWindow
        accountIdentity={accountIdentity}
        initialAgentId={activeAgentId}
        onLogout={() => {
          setAccountIdentity(null);
          setIsMainWindowVisible(false);
        }}
      />
    );
  }

  return (
    <LoginIntroWindow
      onSignIn={(isAdmin, account, nodeType) => {
        setAccountIdentity({
          username: account || "mock-evaluator",
          role: isAdmin ? "admin" : "evaluator",
          nodeType,
        });
      }}
      onAgentEntryComplete={(agentId) => {
        setActiveAgentId(agentId);
        setIsMainWindowVisible(true);
      }}
    />
  );
}
