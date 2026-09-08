"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Database, Globe2, List, MailOpen, Pencil, Send } from "lucide-react";
import { D3D8DetailShell } from "./D3D8DetailShell";
import { CHAIN_DETECTOR_SOURCE, D3_CHAIN_RULES } from "./d3-d8-defense-visualization-data";

type Props = { isVisible: boolean };

const toolIcon = (tool: string) => {
  if (tool === "browser.open_page") return <Globe2 size={21} aria-hidden="true" />;
  if (tool === "memory.write") return <Pencil size={21} aria-hidden="true" />;
  if (tool === "memory.read") return <Database size={21} aria-hidden="true" />;
  if (tool === "email.list") return <List size={21} aria-hidden="true" />;
  if (tool === "email.read") return <MailOpen size={21} aria-hidden="true" />;
  return <Send size={21} aria-hidden="true" />;
};

const matchedIndexes = (tools: readonly string[], sequence: readonly string[]) => {
  const indexes = new Set<number>();
  let sequenceIndex = 0;
  tools.forEach((tool, index) => {
    if (tool === sequence[sequenceIndex]) {
      indexes.add(index);
      sequenceIndex += 1;
    }
  });
  return indexes;
};

export function D3CausalChainPanel({ isVisible }: Props) {
  const [selectedRuleId, setSelectedRuleId] = useState(D3_CHAIN_RULES[0]!.id);
  const rule = D3_CHAIN_RULES.find((item) => item.id === selectedRuleId) ?? D3_CHAIN_RULES[0]!;
  const matched = useMemo(() => matchedIndexes(rule.exampleHistory, rule.sequence), [rule]);

  useEffect(() => {
    if (isVisible) setSelectedRuleId(D3_CHAIN_RULES[0]!.id);
  }, [isVisible]);

  return (
    <D3D8DetailShell
      className="d3-causal-chain-panel"
      visual={
        <div className="d3-chain-visual" aria-label={`因果链：${rule.label}`}>
          <div
            className="d3-chain-track"
            style={{ "--d3-node-count": rule.exampleHistory.length } as CSSProperties}
            data-connection-count={rule.connectionCount}
          >
            {rule.exampleHistory.map((tool, index) => {
              const isMatched = matched.has(index);
              return (
                <div key={`${tool}-${index}`} className={`d3-chain-item${isMatched ? " is-matched" : " is-noise"}`}>
                  <span className="d3-chain-node-core">{toolIcon(tool)}</span>
                  <code>{tool}</code>
                  <small>{isMatched ? "链路步骤" : "历史噪声"}</small>
                  {index < rule.connectionCount ? <span className="d3-chain-segment" aria-hidden="true" /> : null}
                </div>
              );
            })}
          </div>
        </div>
      }
      sources={[CHAIN_DETECTOR_SOURCE]}
      activeLine={rule.sourceLine}
      rules={D3_CHAIN_RULES}
      selectedRuleId={selectedRuleId}
      onRuleSelect={(nextRule) => setSelectedRuleId(nextRule.id)}
    />
  );
}

