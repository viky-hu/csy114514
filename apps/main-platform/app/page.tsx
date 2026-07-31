"use client";

import { LoginIntroWindow } from "./windows/login/LoginIntroWindow";

export default function HomePage() {
  return <LoginIntroWindow onSignIn={() => undefined} />;
}
