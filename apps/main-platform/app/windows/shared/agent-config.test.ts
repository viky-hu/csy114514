import assert from "node:assert/strict";
import test from "node:test";

import {
  CORPMATE_AGENT_DRAFT,
  buildAgentManifest,
  createAgentDraftFromProfile,
  parseAgentHeaders,
} from "./agent-config.ts";

test("buildAgentManifest emits only frozen backend AgentManifest fields", () => {
  const manifest = buildAgentManifest({
    ...CORPMATE_AGENT_DRAFT,
    endpoint: "http://127.0.0.1:9000/chat",
    headers: '{ "Authorization": "Bearer secret" }',
    method: "PATCH",
    requestTemplate: '{ "message": "{{input}}" }',
    responsePath: "$.answer",
  });

  assert.deepEqual(Object.keys(manifest).sort(), [
    "agent_id",
    "capabilities",
    "data_sources",
    "memory",
    "name",
    "tool_permissions",
    "version",
  ]);
  assert.equal(manifest.agent_id, "corpmate-v0");
  assert.equal(manifest.name, "CorpMate v0");
  assert.deepEqual(manifest.memory, { max_entries: 100, type: "persistent" });
  assert.equal("endpoint" in manifest, false);
  assert.equal("headers" in manifest, false);
  assert.equal("request_template" in manifest, false);
});

test("parseAgentHeaders reports malformed JSON without affecting Manifest output", () => {
  assert.deepEqual(parseAgentHeaders(""), {});
  assert.deepEqual(parseAgentHeaders('{ "Content-Type": "application/json" }'), {
    "Content-Type": "application/json",
  });
  assert.equal(parseAgentHeaders("[]"), "Headers must be a JSON object.");
  assert.equal(parseAgentHeaders("{ nope"), "Headers JSON cannot be parsed.");

  const manifest = buildAgentManifest({
    ...CORPMATE_AGENT_DRAFT,
    headers: "{ nope",
  });

  assert.equal(manifest.agent_id, "corpmate-v0");
});

test("createAgentDraftFromProfile hydrates editable state from an AgentProfile", () => {
  const draft = createAgentDraftFromProfile({
    agent_id: "custom-agent",
    manifest: {
      agent_id: "custom-agent",
      capabilities: ["chat", "email.send"],
      data_sources: ["email"],
      memory: { max_entries: 5, type: "ephemeral" },
      name: "Custom Agent",
      tool_permissions: { "email.send": "DENY" },
      version: "2.0.0",
    },
  });

  assert.equal(draft.agentId, "custom-agent");
  assert.equal(draft.agentName, "Custom Agent");
  assert.equal(draft.version, "2.0.0");
  assert.equal(draft.memoryType, "ephemeral");
  assert.equal(draft.memoryMaxEntries, "5");
  assert.equal(draft.enabledCapabilities["email.send"], true);
  assert.equal(draft.toolPermissions["email.send"], "DENY");
  assert.deepEqual(buildAgentManifest(draft), {
    agent_id: "custom-agent",
    capabilities: ["chat", "email.send"],
    data_sources: ["email"],
    memory: { max_entries: 5, type: "ephemeral" },
    name: "Custom Agent",
    tool_permissions: { "email.send": "DENY" },
    version: "2.0.0",
  });
});
