import agentProfile from "../../../../../../csy——全智赛/shared/fixtures/agent_profile.json";
import attackGraph from "../../../../../../csy——全智赛/shared/fixtures/attack_graph.json";
import evaluationReport from "../../../../../../csy——全智赛/shared/fixtures/evaluation_report.json";

import {
  createOverviewViewModel,
  type OverviewInput,
} from "./overview-data";

export const overviewFixtureViewModel = createOverviewViewModel({
  agentProfile: agentProfile as OverviewInput["agentProfile"],
  attackGraph: attackGraph as OverviewInput["attackGraph"],
  evaluationReport: evaluationReport as OverviewInput["evaluationReport"],
});
