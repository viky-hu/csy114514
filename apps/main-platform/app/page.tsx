"use client";

import { useState } from "react";
import { LoginIntroWindow } from "./windows/login/LoginIntroWindow";
import { MainWindow } from "./windows/main/MainWindow";

export default function HomePage() {
  const [isMainWindowVisible, setIsMainWindowVisible] = useState(false);

  if (isMainWindowVisible) {
    return <MainWindow />;
  }

  return (
    <LoginIntroWindow
      onSignIn={() => undefined}
      onAgentEntryComplete={() => setIsMainWindowVisible(true)}
    />
  );
}
