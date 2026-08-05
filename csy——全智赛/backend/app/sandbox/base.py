"""Abstract Sandbox interface."""
from abc import ABC, abstractmethod
from typing import Any


class SandboxBase(ABC):
    """Abstract sandbox — all tool sandboxes inherit from this."""

    @abstractmethod
    def execute(self, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute a tool call and return the result.

        Returns: {"success": bool, "result": Any, "error": str|None}
        """
        ...

    @abstractmethod
    def reset(self, initial_state: dict[str, Any] | None = None) -> None:
        """Reset sandbox to initial state for a new test run."""
        ...

    @abstractmethod
    def snapshot(self) -> dict[str, Any]:
        """Return current sandbox state for inspection/debugging."""
        ...
