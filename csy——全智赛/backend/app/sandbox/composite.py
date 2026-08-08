"""CompositeSandbox — routes and observes every real tool execution."""
import uuid
from collections.abc import Callable
from typing import Any

from backend.app.sandbox.base import SandboxBase
from backend.app.sandbox.browser_sandbox import BrowserSandbox
from backend.app.sandbox.email_sandbox import EmailSandbox
from backend.app.sandbox.memory_sandbox import MemorySandbox

TOOL_SANDBOX_MAP = {
    "browser.open_page": "browser",
    "email.list": "email",
    "email.read": "email",
    "email.send": "email",
    "memory.read": "memory",
    "memory.write": "memory",
}


class CompositeSandbox(SandboxBase):
    """Routes tool calls to the correct sub-sandbox."""

    def __init__(
        self,
        *,
        event_sink: Callable[[str, dict[str, Any]], str] | None = None,
        fingerprint_value: Callable[[str, str], str] | None = None,
        canary: str | None = None,
        canary_fingerprint: str | None = None,
        enforce_email_confirmation: bool = True,
    ):
        self.email = EmailSandbox(enforce_confirmation=enforce_email_confirmation)
        self.memory = MemorySandbox()
        self.browser = BrowserSandbox()
        self._event_sink = event_sink
        self._fingerprint_value = fingerprint_value
        self._canary = canary
        self._canary_fingerprint = canary_fingerprint
        self._turn_id = "turn_1"
        self._session_id = "session_1"
        self._stage = "persistent_memory_poisoning"

    def set_execution_context(self, *, turn_id: str, session_id: str, stage: str) -> None:
        self._turn_id = turn_id
        self._session_id = session_id
        self._stage = stage

    def set_event_sink(self, event_sink: Callable[[str, dict[str, Any]], str] | None) -> None:
        self._event_sink = event_sink

    def _get_sandbox(self, tool_name: str) -> SandboxBase:
        target = TOOL_SANDBOX_MAP.get(tool_name)
        if target == "email":
            return self.email
        elif target == "memory":
            return self.memory
        elif target == "browser":
            return self.browser
        raise ValueError(f"Unknown tool: {tool_name}")

    def execute(self, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        call_id = f"call-{uuid.uuid4().hex[:12]}"
        called_payload = self._safe_payload(
            tool_name=tool_name,
            call_id=call_id,
            raw=arguments,
            success=None,
        )
        called_payload["confirmed"] = bool(arguments.get("confirmed", True))
        self._record("TOOL_CALLED", called_payload)

        sandbox = self._get_sandbox(tool_name)
        try:
            result = sandbox.execute(tool_name, arguments)
        except Exception:  # noqa: BLE001 - the sandbox converts every tool failure into an observed result.
            result = {"success": False, "result": None, "error": "tool runtime error"}

        result_payload = self._safe_payload(
            tool_name=tool_name,
            call_id=call_id,
            raw=result,
            success=result.get("success") is True,
        )
        if result.get("success") is not True:
            result_payload["error_code"] = "TOOL_RUNTIME_ERROR"
        self._record("TOOL_RESULT", result_payload)
        if tool_name == "memory.write" and result.get("success") is True:
            memory_payload = self._safe_payload(
                tool_name=tool_name,
                call_id=call_id,
                raw=arguments,
                success=None,
            )
            memory_payload.pop("tool_name", None)
            memory_payload.pop("matched_canary_fingerprints", None)
            self._record("MEMORY_WRITTEN", memory_payload)
        return result

    def _record(self, event_type: str, payload: dict[str, Any]) -> str | None:
        if self._event_sink is None:
            return None
        return self._event_sink(event_type, payload)

    def _safe_payload(
        self,
        *,
        tool_name: str,
        call_id: str,
        raw: Any,
        success: bool | None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "stage": self._stage,
            "call_id": call_id,
            "turn_id": self._turn_id,
            "session_id": self._session_id,
            "tool_name": tool_name,
        }
        if success is not None:
            payload["success"] = success
        contains_canary = self._contains_canary(raw)
        payload["matched_canary_fingerprints"] = (
            [self._canary_fingerprint]
            if contains_canary and self._canary_fingerprint
            else []
        )
        if contains_canary and self._canary_fingerprint:
            payload["canary_fingerprint"] = self._canary_fingerprint

        mapping = raw if isinstance(raw, dict) else {}
        result = mapping.get("result") if isinstance(mapping.get("result"), dict) else {}
        key = mapping.get("key", result.get("key"))
        value = mapping.get("value", result.get("value"))
        if self._fingerprint_value and isinstance(key, str):
            payload["memory_key_fingerprint"] = self._fingerprint_value("memory_key", key)
        if self._fingerprint_value and isinstance(value, str):
            payload["value_fingerprint"] = self._fingerprint_value("memory_value", value)
        return payload

    def _contains_canary(self, value: Any) -> bool:
        if not self._canary:
            return False
        if isinstance(value, str):
            return self._canary in value
        if isinstance(value, dict):
            return any(self._contains_canary(item) for item in value.values())
        if isinstance(value, (list, tuple)):
            return any(self._contains_canary(item) for item in value)
        return False

    def reset(self, initial_state: dict[str, Any] | None = None) -> None:
        state = initial_state or {}
        self.email.reset(state)
        self.memory.reset(state)
        self.browser.reset(state)

    def snapshot(self) -> dict[str, Any]:
        return {
            "email": self.email.snapshot(),
            "memory": self.memory.snapshot(),
            "browser": self.browser.snapshot(),
        }
