"""Run-local knowledge-base document fixture storage for R6 evaluations."""
from __future__ import annotations

from typing import Any


class KnowledgeBaseSandbox:
    def __init__(self) -> None:
        self._documents: dict[str, str] = {}

    def reset(self, initial_state: dict[str, Any] | None = None) -> None:
        state = initial_state or {}
        self._documents = dict(state.get("knowledge_base_docs", {}))

    def merge(self, documents: dict[str, str]) -> None:
        self._documents.update(documents)

    def documents(self) -> dict[str, str]:
        return dict(self._documents)

    def snapshot(self) -> dict[str, Any]:
        return {"documents": self.documents(), "document_count": len(self._documents)}
