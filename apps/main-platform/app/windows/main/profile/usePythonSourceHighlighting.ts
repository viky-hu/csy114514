"use client";

import { useEffect, useState } from "react";
import { createHighlighterCore, createJavaScriptRegexEngine } from "shiki";
import python from "shiki/langs/python.mjs";
import githubLight from "shiki/themes/github-light.mjs";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export function usePythonSourceHighlighting(source: string) {
  const [highlightedLines, setHighlightedLines] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    let highlighter: Awaited<ReturnType<typeof createHighlighterCore>> | null = null;

    const loadHighlighting = async () => {
      highlighter = await createHighlighterCore({
        langs: [python],
        themes: [githubLight],
        engine: createJavaScriptRegexEngine(),
      });
      if (cancelled) {
        highlighter.dispose();
        highlighter = null;
        return;
      }
      const tokenLines = highlighter.codeToTokens(source, {
        lang: "python",
        theme: "github-light",
      }).tokens;

      if (!cancelled) {
        setHighlightedLines(
          tokenLines.map((tokens) =>
            tokens
              .map((token) => {
                const color = token.color ?? "#30405c";
                return `<span style="color:${color}">${escapeHtml(token.content)}</span>`;
              })
              .join(""),
          ),
        );
      }
    };

    void loadHighlighting();
    return () => {
      cancelled = true;
      highlighter?.dispose();
    };
  }, [source]);

  return highlightedLines;
}
