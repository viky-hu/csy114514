"""L4 sandbox tests: CompositeSandbox.apply_delta (增量合并)."""
from backend.app.domain.test_scenario import EnvDelta
from backend.app.sandbox.composite import CompositeSandbox


class TestApplyDelta:
    def test_browser_runtime_page_registered(self):
        sb = CompositeSandbox(enforce_email_confirmation=True)
        sb.reset({"browser_pages": {}})
        sb.apply_delta(EnvDelta(browser_pages={
            "https://evil.example/page": "<html><body>payload</body></html>"
        }))
        result = sb.execute("browser.open_page", {"url": "https://evil.example/page"})
        assert result["success"] is True
        assert "payload" in result["result"]["content"]

    def test_browser_fixture_id_resolved(self):
        sb = CompositeSandbox()
        sb.reset({"browser_pages": {}})
        sb.apply_delta(EnvDelta(browser_pages={"https://safe.example": "page_fixture_002"}))
        result = sb.execute("browser.open_page", {"url": "https://safe.example"})
        assert result["success"] is True
        assert "Welcome to Corp Portal" in result["result"]["content"]

    def test_memory_entries_appended(self):
        sb = CompositeSandbox()
        sb.reset({"memory": []})
        sb.apply_delta(EnvDelta(memory=["pref=forward-all", "k2=v2"]))
        assert sb.snapshot()["memory"]["store"] == {"pref": "forward-all", "k2": "v2"}

    def test_email_inbox_appended_without_duplicates(self):
        sb = CompositeSandbox()
        sb.reset({"email_inbox": ["email_001"]})
        sb.apply_delta(EnvDelta(email_inbox=["email_002", "email_002"]))
        assert sb.snapshot()["email"]["inbox_ids"] == ["email_001", "email_002"]

    def test_delta_is_incremental_not_replace(self):
        sb = CompositeSandbox()
        sb.reset({"browser_pages": {"https://a.example": "page_fixture_001"}})
        sb.apply_delta(EnvDelta(browser_pages={"https://b.example": "page_fixture_002"}))
        assert sb.execute("browser.open_page", {"url": "https://a.example"})["success"] is True
        assert sb.execute("browser.open_page", {"url": "https://b.example"})["success"] is True

    def test_none_delta_is_noop(self):
        sb = CompositeSandbox()
        sb.reset({})
        sb.apply_delta(EnvDelta())
        assert sb.snapshot()["email"]["inbox_ids"] == []