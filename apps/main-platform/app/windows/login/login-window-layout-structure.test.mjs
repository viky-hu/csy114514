import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import test from "node:test";

const loginStyles = readFileSync(
  new URL("../../styles/window-1-login.css", import.meta.url),
  "utf8",
);
const loginSource = readFileSync(
  new URL("./LoginIntroWindow.tsx", import.meta.url),
  "utf8",
);
const splitTipUrl = new URL("./LoginSplitLoadingTip.tsx", import.meta.url);
const loadingSessionUrl = new URL("./login-loading-session.ts", import.meta.url);

test("login placeholder root keeps the original parent-relative width", () => {
  const rootBlock = loginStyles.match(/\.login-placeholder-page\s*\{(?<body>[^}]*)\}/);

  assert.ok(rootBlock?.groups?.body);
  assert.match(rootBlock.groups.body, /width:\s*100%;/);
  assert.doesNotMatch(rootBlock.groups.body, /width:\s*100vw;/);
});

test("login color band and panel keep a generous target width", () => {
  assert.match(loginSource, /const panelWidthInPx = 11 \* \(96 \/ 2\.54\);/);
  assert.match(loginSource, /window\.innerWidth \* 0\.074,\s*72\),\s*122\)/);
  assert.doesNotMatch(loginSource, /const panelWidthInPx = 10 \* \(96 \/ 2\.54\);/);
  assert.doesNotMatch(loginSource, /const panelWidthInPx = 12 \* \(96 \/ 2\.54\);/);
  assert.doesNotMatch(loginSource, /window\.innerWidth \* 0\.1,\s*96\),\s*168\)/);
});

test("login Agent loading tips use the local SplitText component", () => {
  assert.equal(existsSync(splitTipUrl), true);
  assert.equal(existsSync(loadingSessionUrl), true);

  const splitTipSource = readFileSync(splitTipUrl, "utf8");

  assert.match(loginSource, /LoginSplitLoadingTip,/);
  assert.match(
    loginSource,
    /createLoginLoadingTipSequence,/,
  );
  assert.match(
    loginSource,
    /<LoginSplitLoadingTip\s+text=\{loadingTip\.text\}\s+active=\{agentEntryStage === "loading"\}\s+phase=\{loadingTipPhase\}\s+onExitComplete=\{\(\) =>\s*loadingTipExitCompleteRef\.current\(loadingSessionId,\s*loadingTip\.id\)\s*\}/,
  );
  assert.doesNotMatch(loginSource, /<LoginSplitLoadingTip\s+key=/);
  assert.match(loginSource, /createLoginLoadingSessionController/);
  assert.match(loginSource, /scheduleLoadingTip\(initialAction\.presentation,\s*sessionId,\s*true\)/);
  assert.match(loginSource, /startLoadingTipEntrance\(sessionId,\s*initialAction\.presentation\)/);
  assert.match(
    loginSource,
    /const advanceLoadingTipSequence = \(sessionId: number, tipId: string\) =>/,
  );
  assert.doesNotMatch(
    loginSource,
    /const advanceLoadingTipSequence = withContextSafe/,
  );
  assert.match(loginSource, /const LOADING_TIP_EXIT_FALLBACK_MS = 220;/);
  assert.match(
    loginSource,
    /loadingTipExitCompleteRef\.current\(sessionId,\s*presentation\.tip\.id\)/,
  );
  assert.match(
    loginSource,
    /className="login-agent-bracket-button is-secondary"[\s\S]*?onClick=\{\(\) => beginAgentLoadingRef\.current\(DEFAULT_AGENT_ID\)\}[\s\S]*?<span>稍后再说<\/span>/,
  );
  assert.doesNotMatch(loginSource, /\.login-agent-loading-char/);
  assert.doesNotMatch(loginSource, /loadingTextTimeline/);
  assert.doesNotMatch(loginSource, /intervalMs:\s*1400/);
  assert.doesNotMatch(loginSource, /setTimeout\(finishAgentLoading,\s*5000\)/);
  assert.match(splitTipSource, /import \{ SplitText \} from "gsap\/SplitText";/);
  assert.match(splitTipSource, /gsap\.registerPlugin\(useGSAP, SplitText\)/);
  assert.match(
    splitTipSource,
    /export type LoginSplitLoadingTipPhase = "enter" \| "hold" \| "exit";/,
  );
  assert.match(splitTipSource, /phase:\s*LoginSplitLoadingTipPhase;/);
  assert.match(splitTipSource, /onExitComplete\?: \(\) => void;/);
  assert.match(splitTipSource, /type:\s*"chars"/);
  assert.match(splitTipSource, /aria:\s*"auto"/);
  assert.match(splitTipSource, /reduceWhiteSpace:\s*false/);
  assert.match(splitTipSource, /duration:\s*0\.28/);
  assert.match(splitTipSource, /entranceStagger/);
  assert.match(splitTipSource, /exitCompletionRef/);
  assert.match(splitTipSource, /preparedTextRef/);
  assert.match(splitTipSource, /splitRef/);
  assert.doesNotMatch(splitTipSource, /revertOnUpdate:\s*true/);
  assert.doesNotMatch(splitTipSource, />\s*\{text\}\s*<\/div>/);
});

test("login SplitText tip wrapper keeps a stable centered text measure", () => {
  const loadingTextBlock = loginStyles.match(
    /\.login-agent-loading-text\s*\{(?<body>[^}]*)\}/,
  );

  assert.ok(loadingTextBlock?.groups?.body);
  assert.match(loadingTextBlock.groups.body, /\n\s+width:\s*min\(82vw,\s*720px\);/);
  assert.match(loadingTextBlock.groups.body, /min-width:\s*0;/);
  assert.match(loadingTextBlock.groups.body, /opacity:\s*0;/);
  assert.match(loadingTextBlock.groups.body, /visibility:\s*hidden;/);

  const loadingCharBlock = loginStyles.match(
    /\.login-agent-loading-char\s*\{(?<body>[^}]*)\}/,
  );

  assert.ok(loadingCharBlock?.groups?.body);
  assert.match(loadingCharBlock.groups.body, /font:\s*inherit;/);
  assert.match(loadingCharBlock.groups.body, /line-height:\s*inherit;/);
});
