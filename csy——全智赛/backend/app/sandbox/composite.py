"""CompositeSandbox — routes tool calls to the correct sandbox."""
from typing import Any
from backend.app.sandbox.base import SandboxBase
from backend.app.sandbox.email_sandbox import EmailSandbox
from backend.app.sandbox.memory_sandbox import MemorySandbox
from backend.app.sandbox.browser_sandbox import BrowserSandbox


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

    def __init__(self):
        self.email = EmailSandbox()
        self.memory = MemorySandbox()
        self.browser = BrowserSandbox()

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
        sandbox = self._get_sandbox(tool_name)
        return sandbox.execute(tool_name, arguments)

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
