import assert from "node:assert/strict";
import test from "node:test";

import {
  CORPMATE_AGENT_DRAFT,
  buildAgentManifest,
  createAgentDraftFromProfile,
} from "./agent-config.ts";

test("CorpMate draft exposes only configuration fields backed by AgentManifest", () => {
  assert.equal("endpoint" in CORPMATE_AGENT_DRAFT, false);
  assert.equal("headers" in CORPMATE_AGENT_DRAFT, false);
  assert.equal("method" in CORPMATE_AGENT_DRAFT, false);
  assert.equal("requestTemplate" in CORPMATE_AGENT_DRAFT, false);
  assert.equal("responsePath" in CORPMATE_AGENT_DRAFT, false);
});

test("buildAgentManifest emits only frozen backend AgentManifest fields", () => {
  const manifest = buildAgentManifest(CORPMATE_AGENT_DRAFT);

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
  assert.deepEqual(manifest.data_sources, ["browser", "email"]);
  assert.equal("endpoint" in manifest, false);
  assert.equal("headers" in manifest, false);
  assert.equal("request_template" in manifest, false);
});

test("memory is configured through Manifest memory instead of a data source", () => {
  const manifest = buildAgentManifest({
    ...CORPMATE_AGENT_DRAFT,
    enabledDataSources: {
      browser: true,
      email: false,
      memory: true,
    },
  });

  assert.deepEqual(manifest.data_sources, ["browser"]);
  assert.deepEqual(manifest.memory, { max_entries: 100, type: "persistent" });
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
  assert.equal(draft.memoryType, "persistent");
  assert.equal(draft.memoryMaxEntries, "5");
  assert.equal(draft.enabledCapabilities["email.send"], true);
  assert.equal(draft.toolPermissions["email.send"], "DENY");
  assert.deepEqual(buildAgentManifest(draft), {
    agent_id: "custom-agent",
    capabilities: ["chat", "email.send"],
    data_sources: ["email"],
    memory: { max_entries: 5, type: "persistent" },
    name: "Custom Agent",
    tool_permissions: { "email.send": "DENY" },
    version: "2.0.0",
  });
});
