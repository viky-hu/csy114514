import agentProfile from "../../../../../../csy——全智赛/shared/fixtures/agent_profile.json";
import attackGraph from "../../../../../../csy——全智赛/shared/fixtures/attack_graph.json";

import {
  createSecurityProfileViewModel,
  type SecurityProfileInput,
} from "./security-profile-data";

export const securityProfileFixtureInput = {
  agentProfile: agentProfile as SecurityProfileInput["agentProfile"],
  attackGraph: attackGraph as SecurityProfileInput["attackGraph"],
};

export const securityProfileFixtureViewModel = createSecurityProfileViewModel(
  securityProfileFixtureInput,
);
