"""D3 确认门控 — 前后端授权闭环.

当 Agent 调用 email.send 等需要用户确认的工具时,
ConfirmationManager 阻塞执行线程, 等待前端回传用户决定.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ConfirmationRequest:
    """一个待确认的工具调用请求."""

    call_id: str
    run_id: str
    tool_name: str
    arguments: dict[str, Any]
    event: threading.Event = field(default_factory=threading.Event)
    decision: Optional[str] = None  # "allowed" | "denied" | None (timeout)


class ConfirmationManager:
    """Per-run 确认管理器, 线程安全.

    - ``interactive=True``: 阻塞等待前端回传 (前端 UI 评估)
    - ``interactive=False``: 立即返回 ``"denied"`` (CLI / 脚本评估)
    """

    def __init__(self, *, interactive: bool = True, timeout: float = 60.0) -> None:
        self._pending: dict[str, ConfirmationRequest] = {}
        self._lock = threading.Lock()
        self.interactive = interactive
        self.timeout = timeout

    # ------------------------------------------------------------------
    # 调用方: CompositeSandbox (执行线程)
    # ------------------------------------------------------------------

    def request_confirmation(
        self,
        call_id: str,
        run_id: str,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> str:
        """阻塞等待用户确认, 返回 ``"allowed"`` 或 ``"denied"``.

        超时或非交互模式自动返回 ``"denied"``.
        """
        if not self.interactive:
            return "denied"

        req = ConfirmationRequest(
            call_id=call_id,
            run_id=run_id,
            tool_name=tool_name,
            arguments=arguments,
        )
        with self._lock:
            self._pending[call_id] = req

        req.event.wait(timeout=self.timeout)

        with self._lock:
            self._pending.pop(call_id, None)

        return req.decision or "denied"

    # ------------------------------------------------------------------
    # 调用方: API 端点 (HTTP 线程)
    # ------------------------------------------------------------------

    def submit_decision(self, call_id: str, decision: str) -> bool:
        """提交用户决定, 解除执行线程阻塞. 返回是否成功."""
        with self._lock:
            req = self._pending.get(call_id)
        if req is None:
            return False
        req.decision = decision
        req.event.set()
        return True

    def has_pending(self, call_id: str) -> bool:
        """检查是否有待确认的请求."""
        with self._lock:
            return call_id in self._pending
