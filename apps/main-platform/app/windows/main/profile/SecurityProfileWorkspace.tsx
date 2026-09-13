"use client";

import { useEffect, useMemo, useState } from "react";
import { SecurityProfileGraph } from "./SecurityProfileGraph";
import {
  securityProfileFixtureInput,
  securityProfileFixtureViewModel,
} from "./profile-fixtures";
import {
  ApiSecurityProfileRepository,
  MockSecurityProfileRepository,
  type SecurityProfileRepositoryResult,
} from "./security-profile-repository";
import type { AgentTopology } from "../topology/topology-types";
import type { SidebarContentMetrics } from "../shared/useFrozenGraphInlineSize";

type SecurityProfileWorkspaceProps = {
  agentId: string;
  isGraphFrozen: boolean;
  sidebarContentMetrics: SidebarContentMetrics;
  topology?: AgentTopology;
};

const fallbackRepository = new MockSecurityProfileRepository(
  securityProfileFixtureViewModel,
  securityProfileFixtureInput.attackGraph,
);
const defaultRepository = new ApiSecurityProfileRepository({
  fallback: fallbackRepository,
});

export function SecurityProfileWorkspace({
  agentId,
  isGraphFrozen,
  sidebarContentMetrics,
  topology,
}: SecurityProfileWorkspaceProps) {
  const [result, setResult] = useState<SecurityProfileRepositoryResult>({
    attackGraph: securityProfileFixtureInput.attackGraph,
    source: "mock",
    viewModel: securityProfileFixtureViewModel,
  });

  useEffect(() => {
    let ignore = false;

    void defaultRepository.load(agentId).then((nextResult) => {
      if (!ignore) {
        setResult(nextResult);
      }
    });

    return () => {
      ignore = true;
    };
  }, [agentId, topology?.topology_type]);

  const viewModel = useMemo(() => result.viewModel, [result.viewModel]);

  return (
    <SecurityProfileGraph
      dataSource={result.source}
      attackGraph={result.attackGraph}
      errorMessage={result.errorMessage}
      isGraphFrozen={isGraphFrozen}
      sidebarContentMetrics={sidebarContentMetrics}
      topology={topology}
      viewModel={viewModel}
    />
  );
}
