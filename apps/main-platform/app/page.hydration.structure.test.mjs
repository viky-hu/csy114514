import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("page defers URL-dependent mock mode until after hydration", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.match(source, /useState\(false\)/);
  assert.doesNotMatch(
    source,
    /useState\(\(\)\s*=>\s*typeof window !== "undefined"\s*&&\s*isEvaluationMockEnabled\(window\.location\.search\)\)/,
  );
  assert.match(source, /useEffect\(\(\) => \{[\s\S]*isEvaluationMockEnabled\(window\.location\.search\)/);
});
