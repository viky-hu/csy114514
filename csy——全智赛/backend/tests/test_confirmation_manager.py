"""Tests for ConfirmationManager — D3 确认门控闭环."""

from __future__ import annotations

import threading
import time

import pytest

from backend.app.confirmation import ConfirmationManager, ConfirmationRequest


class TestNonInteractive:
    """CLI / 脚本模式: 自动拒绝, 不阻塞."""

    def test_non_interactive_returns_denied_immediately(self):
        cm = ConfirmationManager(interactive=False)
        decision = cm.request_confirmation(
            call_id="call-001",
            run_id="run-1",
            tool_name="email.send",
            arguments={"to": "a@b.com"},
        )
        assert decision == "denied"

    def test_submit_decision_returns_false_when_non_interactive(self):
        cm = ConfirmationManager(interactive=False)
        cm.request_confirmation("call-001", "run-1", "email.send", {})
        assert cm.submit_decision("call-001", "allowed") is False


class TestInteractive:
    """前端 UI 模式: 阻塞等待, 回传解除."""

    def test_allowed_decision(self):
        cm = ConfirmationManager(interactive=True, timeout=5)

        def simulate_user():
            time.sleep(0.1)
            cm.submit_decision("call-001", "allowed")

        t = threading.Thread(target=simulate_user)
        t.start()

        decision = cm.request_confirmation(
            call_id="call-001",
            run_id="run-1",
            tool_name="email.send",
            arguments={"to": "user@corp.com"},
        )
        t.join()
        assert decision == "allowed"

    def test_denied_decision(self):
        cm = ConfirmationManager(interactive=True, timeout=5)

        def simulate_user():
            time.sleep(0.1)
            cm.submit_decision("call-001", "denied")

        t = threading.Thread(target=simulate_user)
        t.start()

        decision = cm.request_confirmation("call-001", "run-1", "email.send", {})
        t.join()
        assert decision == "denied"

    def test_timeout_returns_denied(self):
        cm = ConfirmationManager(interactive=True, timeout=0.2)
        decision = cm.request_confirmation("call-001", "run-1", "email.send", {})
        assert decision == "denied"

    def test_has_pending(self):
        cm = ConfirmationManager(interactive=True, timeout=5)
        assert cm.has_pending("call-001") is False

        barrier = threading.Event()

        def requester():
            barrier.set()
            cm.request_confirmation("call-001", "run-1", "email.send", {})

        t = threading.Thread(target=requester)
        t.start()
        barrier.wait(timeout=2)
        time.sleep(0.1)  # give request_confirmation time to register

        assert cm.has_pending("call-001") is True
        cm.submit_decision("call-001", "allowed")
        t.join()

        assert cm.has_pending("call-001") is False

    def test_submit_unknown_call_id(self):
        cm = ConfirmationManager(interactive=True, timeout=5)
        assert cm.submit_decision("nonexistent", "allowed") is False

    def test_multiple_concurrent_confirmations(self):
        cm = ConfirmationManager(interactive=True, timeout=5)
        results: dict[str, str] = {}

        def requester(call_id: str):
            results[call_id] = cm.request_confirmation(
                call_id, "run-1", "email.send", {}
            )

        t1 = threading.Thread(target=requester, args=("call-A",))
        t2 = threading.Thread(target=requester, args=("call-B",))
        t1.start()
        t2.start()

        time.sleep(0.1)
        cm.submit_decision("call-A", "allowed")
        cm.submit_decision("call-B", "denied")

        t1.join()
        t2.join()

        assert results["call-A"] == "allowed"
        assert results["call-B"] == "denied"


class TestConfirmationRequest:
    def test_defaults(self):
        req = ConfirmationRequest(
            call_id="c1", run_id="r1", tool_name="email.send", arguments={}
        )
        assert req.decision is None
        assert isinstance(req.event, threading.Event)
        assert not req.event.is_set()
