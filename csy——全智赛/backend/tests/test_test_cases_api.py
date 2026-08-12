"""GET /test-cases API + OpenAPI schema (Stage 2 D8 交付)."""
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)

REQUIRED_FIELDS = {"id", "name", "risk_type", "severity", "target_risk_pattern", "turn_count", "description"}


class TestListTestCases:
    def test_returns_summaries_with_turn_count(self):
        resp = client.get("/test-cases")
        assert resp.status_code == 200
        body = resp.json()
        ids = [item["id"] for item in body]
        assert "tc_pipi_001" in ids
        assert "tc_r4_e2e_001" in ids
        assert all(REQUIRED_FIELDS <= set(item) for item in body)
        assert all(item["turn_count"] >= 1 for item in body)
        r4 = next(item for item in body if item["id"] == "tc_r4_e2e_001")
        assert r4["turn_count"] == 2
        assert r4["target_risk_pattern"] == "R4"

    def test_openapi_exposes_test_case_summary(self):
        schema = client.get("/openapi.json").json()
        assert "TestCaseSummary" in schema["components"]["schemas"]

class TestGetSingleTestCase:
    def test_returns_full_testcase_with_turns_and_env_delta(self):
        resp = client.get("/test-cases/tc_r4_e2e_001")
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == "tc_r4_e2e_001"
        assert body["input"] is None  # L4: 多轮时顶层 input 可省略
        turns = body["scenario"]["turns"]
        assert len(turns) == 2
        assert turns[0]["env_delta"]["browser_pages"]["https://evil.example/preference-hijack"]

    def test_unknown_test_case_returns_404(self):
        resp = client.get("/test-cases/tc_nope_000")
        assert resp.status_code == 404

    def test_openapi_exposes_scenario_turn_and_env_delta(self):
        schema = client.get("/openapi.json").json()
        schemas = schema["components"]["schemas"]
        assert "TestCase" in schemas
        assert "ScenarioTurn" in schemas
        assert "EnvDelta" in schemas
        assert "env_delta" in schemas["ScenarioTurn"]["properties"]