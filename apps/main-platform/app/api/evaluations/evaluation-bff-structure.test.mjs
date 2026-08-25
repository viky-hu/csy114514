import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const eventsRoute = new URL("./[evaluationId]/events/route.ts", import.meta.url);
const comparisonEventsRoute = new URL("./comparisons/[comparisonId]/events/route.ts", import.meta.url);

test("evaluation SSE BFF forwards resume cursor and request cancellation", async () => {
  const source = await readFile(eventsRoute, "utf8");

  assert.match(source, /request\.headers\.get\("Last-Event-ID"\)/);
  assert.match(source, /"Last-Event-ID": lastEventId/);
  assert.match(source, /signal: request\.signal/);
  assert.match(source, /forwardEventStream\(upstream\)/);
});

test("comparison SSE BFF forwards resume cursor and cancellation", async () => {
  const source = await readFile(comparisonEventsRoute, "utf8");

  assert.match(source, /request\.headers\.get\("Last-Event-ID"\)/);
  assert.match(source, /"Last-Event-ID": request\.headers\.get\("Last-Event-ID"\)/);
  assert.match(source, /signal: request\.signal/);
  assert.match(source, /forwardEventStream\(upstream\)/);
});
