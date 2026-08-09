"""Test SandboxTool implementations."""
import pytest
from backend.app.sandbox.email_sandbox import EmailSandbox, SAMPLE_EMAILS
from backend.app.sandbox.memory_sandbox import MemorySandbox
from backend.app.sandbox.browser_sandbox import BrowserSandbox
from backend.app.sandbox.composite import CompositeSandbox


class TestEmailSandbox:
    def test_list_empty_inbox(self):
        sb = EmailSandbox()
        result = sb.execute("email.list", {})
        assert result["success"] is True
        assert result["result"] == []

    def test_list_with_emails(self):
        sb = EmailSandbox()
        sb.reset({"email_inbox": ["email_001", "email_002"]})
        result = sb.execute("email.list", {})
        assert result["success"] is True
        assert len(result["result"]) == 2
        assert result["result"][0]["subject"] == "Q3 Budget Review"

    def test_read_existing_email(self):
        sb = EmailSandbox()
        sb.reset({"email_inbox": ["email_001"]})
        result = sb.execute("email.read", {"email_id": "email_001"})
        assert result["success"] is True
        assert "Q3 budget" in result["result"]["body"]

    def test_read_missing_email(self):
        sb = EmailSandbox()
        result = sb.execute("email.read", {"email_id": "nonexistent"})
        assert result["success"] is False

    def test_send_without_confirmation_fails(self):
        sb = EmailSandbox()
        result = sb.execute("email.send", {
            "to": "test@test.com", "subject": "x", "body": "x", "confirmed": False
        })
        assert result["success"] is False

    def test_send_with_confirmation_succeeds(self):
        sb = EmailSandbox()
        result = sb.execute("email.send", {
            "to": "test@test.com", "subject": "x", "body": "x", "confirmed": True
        })
        assert result["success"] is True

    def test_reset_clears_state(self):
        sb = EmailSandbox()
        sb.reset({"email_inbox": ["email_001"]})
        sb.execute("email.send", {"to": "x", "subject": "x", "body": "x", "confirmed": True})
        sb.reset({"email_inbox": ["email_002"]})
        assert len(sb.snapshot()["inbox_ids"]) == 1
        assert sb.snapshot()["sent_count"] == 0


class TestMemorySandbox:
    def test_read_missing_key(self):
        sb = MemorySandbox()
        result = sb.execute("memory.read", {"key": "nonexistent"})
        assert result["success"] is True
        assert result["result"] is None

    def test_write_and_read(self):
        sb = MemorySandbox()
        sb.execute("memory.write", {"key": "greeting", "value": "hello"})
        result = sb.execute("memory.read", {"key": "greeting"})
        assert result["result"]["value"] == "hello"

    def test_cross_turn_persistence(self):
        sb = MemorySandbox()
        sb.execute("memory.write", {"key": "k1", "value": "v1"})
        # Reading again simulates next turn
        result = sb.execute("memory.read", {"key": "k1"})
        assert result["result"]["value"] == "v1"

    def test_reset_with_initial_state(self):
        sb = MemorySandbox()
        sb.reset({"memory": [{"key": "k1", "value": "v1"}, {"key": "k2", "value": "v2"}]})
        assert sb.snapshot()["entry_count"] == 2

    def test_reset_clears_state(self):
        sb = MemorySandbox()
        sb.execute("memory.write", {"key": "k1", "value": "v1"})
        sb.reset()
        assert sb.snapshot()["entry_count"] == 0


class TestBrowserSandbox:
    def test_open_registered_page(self):
        sb = BrowserSandbox()
        sb.reset({"browser_pages": {"https://malicious.example": "page_fixture_001"}})
        result = sb.execute("browser.open_page", {"url": "https://malicious.example"})
        assert result["success"] is True
        assert "hidden" in result["result"]["content"]

    def test_open_unregistered_url_fails(self):
        sb = BrowserSandbox()
        result = sb.execute("browser.open_page", {"url": "https://unknown.example"})
        assert result["success"] is False

    def test_reset_clears_pages(self):
        sb = BrowserSandbox()
        sb.reset({"browser_pages": {"https://malicious.example": "page_fixture_001"}})
        sb.reset()
        assert len(sb.snapshot()["pages_registered"]) == 0


class TestCompositeSandbox:
    def test_routes_to_correct_sandbox(self):
        sb = CompositeSandbox()
        sb.reset({
            "email_inbox": ["email_001"],
            "memory": [{"key": "k1", "value": "v1"}],
            "browser_pages": {"https://safe.example": "page_fixture_002"},
        })
        assert sb.execute("email.list", {})["success"] is True
        assert sb.execute("memory.read", {"key": "k1"})["result"]["value"] == "v1"
        assert sb.execute("browser.open_page", {"url": "https://safe.example"})["success"] is True

    def test_unknown_tool_raises(self):
        sb = CompositeSandbox()
        with pytest.raises(ValueError, match="Unknown tool"):
            sb.execute("calendar.add", {})

    def test_reset_all(self):
        sb = CompositeSandbox()
        sb.reset({"email_inbox": ["email_001"], "memory": [], "browser_pages": {}})
        sb.reset({"email_inbox": [], "memory": [], "browser_pages": {}})
        snap = sb.snapshot()
        assert snap["email"]["inbox_count"] == 0
        assert snap["memory"]["entry_count"] == 0

    def test_snapshot(self):
        sb = CompositeSandbox()
        sb.reset({"email_inbox": ["email_001"], "memory": [{"key": "x", "value": "y"}], "browser_pages": {}})
        snap = sb.snapshot()
        assert "email" in snap
        assert "memory" in snap
        assert "browser" in snap
