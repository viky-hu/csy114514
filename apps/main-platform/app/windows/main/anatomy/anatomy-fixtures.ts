import agentProfile from "../../../../../../csy——全智赛/shared/fixtures/agent_profile.json";
import attackGraph from "../../../../../../csy——全智赛/shared/fixtures/attack_graph.json";
import evaluationReport from "../../../../../../csy——全智赛/shared/fixtures/evaluation_report.json";
import attackSeeds from "../../../../../../csy——全智赛/shared/examples/security/attack_seeds.json";
import riskPatterns from "../../../../../../csy——全智赛/shared/examples/security/risk_patterns.json";
import testCases from "../../../../../../csy——全智赛/shared/examples/security/security_testcases.json";

import {
  createAnatomyViewModel,
  type AnatomyInput,
} from "./anatomy-data";

export const DEFAULT_ANATOMY_AGENT_ID = "corpmate-v0";
export const DEFAULT_ANATOMY_EVALUATION_ID = "eval-001";

export const anatomyPreviewInput = {
  agentProfile: agentProfile as AnatomyInput["agentProfile"],
  attackGraph: attackGraph as AnatomyInput["attackGraph"],
  attackSeeds: attackSeeds as AnatomyInput["attackSeeds"],
  evaluationReport: evaluationReport as AnatomyInput["evaluationReport"],
  mode: "preview",
  riskPatterns: riskPatterns as AnatomyInput["riskPatterns"],
  selectedPathId: "R4",
  testCases: testCases as AnatomyInput["testCases"],
} satisfies AnatomyInput;

export const anatomyPreviewViewModel = createAnatomyViewModel(anatomyPreviewInput);

export function createLiveAnatomyViewModel(
  attackGraphPayload: AnatomyInput["attackGraph"],
  evaluationReportPayload: AnatomyInput["evaluationReport"],
  selectedPathId = "R4",
) {
  return createAnatomyViewModel({
    ...anatomyPreviewInput,
    attackGraph: attackGraphPayload,
    evaluationReport: evaluationReportPayload,
    mode: "live",
    selectedPathId,
  });
}
