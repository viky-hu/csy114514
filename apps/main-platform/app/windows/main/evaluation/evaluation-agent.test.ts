import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_EVALUATION_AGENT_ID,
  EVALUATION_AGENT_OPTIONS,
  getEvaluationAgentMeta,
} from "./evaluation-agent.ts";

test("exposes the three Stage 3 Agent options with defended LLM as default", () => {
  assert.deepEqual(EVALUATION_AGENT_OPTIONS.map((agent) => agent.id), [
    "corpmate-v0",
    "llm-agent-v0",
    "defended-llm-v0",
  ]);
  assert.equal(DEFAULT_EVALUATION_AGENT_ID, "defended-llm-v0");
  assert.equal(getEvaluationAgentMeta("llm-agent-v0").tone, "warning");
  assert.equal(getEvaluationAgentMeta("defended-llm-v0").tone, "safe");
});

test("unknown Agents have a neutral non-LLM fallback label", () => {
  assert.deepEqual(getEvaluationAgentMeta("custom-v1"), {
    id: "custom-v1",
    label: "Agent · custom-v1",
    shortLabel: "Agent",
    tone: "neutral",
    isLlm: false,
  });
});
