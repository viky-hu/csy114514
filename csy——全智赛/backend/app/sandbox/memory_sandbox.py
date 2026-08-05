"""MemorySandbox — persistent key-value memory for CorpMate."""
from typing import Any
from backend.app.sandbox.base import SandboxBase


class MemorySandbox(SandboxBase):
    """Simulated persistent agent memory. Supports cross-turn persistence + scenario reset."""

    def __init__(self):
        self._store: dict[str, str] = {}

    def execute(self, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if tool_name == "memory.read":
            return self._read(arguments)
        elif tool_name == "memory.write":
            return self._write(arguments)
        else:
            return {"success": False, "result": None, "error": f"Unknown tool: {tool_name}"}

    def _read(self, args: dict[str, Any]) -> dict[str, Any]:
        key = args.get("key", "")
        value = self._store.get(key)
        if value is None:
            return {"success": True, "result": None, "error": None}
        return {"success": True, "result": {"key": key, "value": value}, "error": None}

    def _write(self, args: dict[str, Any]) -> dict[str, Any]:
        key = args.get("key", "")
        value = args.get("value", "")
        self._store[key] = value
        return {"success": True, "result": {"key": key, "value": value, "written": True}, "error": None}

    def reset(self, initial_state: dict[str, Any] | None = None) -> None:
        self._store = {}
        if initial_state:
            for entry in initial_state.get("memory", []):
                self._store[entry["key"]] = entry["value"]

    def snapshot(self) -> dict[str, Any]:
        return {"store": dict(self._store), "entry_count": len(self._store)}
