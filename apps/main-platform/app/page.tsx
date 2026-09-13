"use client";

import { useEffect, useState } from "react";
import { LoginIntroWindow } from "./windows/login/LoginIntroWindow";
import { MainWindow } from "./windows/main/MainWindow";
import { DEFAULT_AGENT_ID } from "./windows/shared/agent-config";
import { isEvaluationMockEnabled } from "./windows/main/evaluation/evaluation-mock";

type AccountIdentity = {
  username: string;
  role: string;
  nodeType?: string;
};

export default function HomePage() {
  const [mockMode, setMockMode] = useState(() => typeof window !== "undefined" && isEvaluationMockEnabled(window.location.search));
  const [isMainWindowVisible, setIsMainWindowVisible] = useState(() => typeof window !== "undefined" && isEvaluationMockEnabled(window.location.search));
  const [activeAgentId, setActiveAgentId] = useState(DEFAULT_AGENT_ID);
  const [accountIdentity, setAccountIdentity] = useState<AccountIdentity | null>(null);

  useEffect(() => {
    const enabled = isEvaluationMockEnabled(window.location.search);
    setMockMode(enabled);
    if (enabled) setIsMainWindowVisible(true);
  }, []);

  if (isMainWindowVisible) {
    return (
      <MainWindow
        accountIdentity={accountIdentity}
        initialAgentId={activeAgentId}
        mockMode={mockMode}
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
