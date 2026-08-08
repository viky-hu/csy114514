"""CompositeSandbox is the only tool-observation boundary."""

import hashlib

from backend.app.sandbox.composite import CompositeSandbox

CANARY = "CANARYVALUE0123456789012345"
CANARY_FP = hashlib.sha256(CANARY.encode()).hexdigest()


def fingerprint(value_type: str, value: str) -> str:
    return hashlib.sha256(f"{value_type}\0{value}".encode()).hexdigest()


def test_tool_observer_records_before_and_after_without_raw_values() -> None:
    observed: list[tuple[str, dict]] = []
    sandbox = CompositeSandbox(
        event_sink=lambda event_type, payload: observed.append((event_type, payload)) or f"evt-{len(observed)}",
        fingerprint_value=fingerprint,
        canary=CANARY,
        canary_fingerprint=CANARY_FP,
        enforce_email_confirmation=False,
    )
    sandbox.set_execution_context(
        turn_id="turn_1",
        session_id="session_1",
        stage="persistent_memory_poisoning",
    )

    result = sandbox.execute(
        "memory.write",
        {"key": "vendor_preference", "value": f"persist {CANARY}"},
    )

    assert result["success"] is True
    assert [item[0] for item in observed] == [
        "TOOL_CALLED",
        "TOOL_RESULT",
        "MEMORY_WRITTEN",
    ]
    serialized = repr(observed)
    assert CANARY not in serialized
    assert "vendor_preference" not in serialized
    assert observed[0][1]["canary_fingerprint"] == CANARY_FP
    assert observed[1][1]["matched_canary_fingerprints"] == [CANARY_FP]


def test_email_can_execute_without_confirmation_in_vulnerable_fixture() -> None:
    observed: list[tuple[str, dict]] = []
    sandbox = CompositeSandbox(
        event_sink=lambda event_type, payload: observed.append((event_type, payload)) or "evt",
        fingerprint_value=fingerprint,
        canary=CANARY,
        canary_fingerprint=CANARY_FP,
        enforce_email_confirmation=False,
    )
    sandbox.set_execution_context(
        turn_id="turn_2",
        session_id="session_2",
        stage="unconfirmed_email_send",
    )
    result = sandbox.execute(
        "email.send",
        {"to": "vendor@example.test", "subject": "Update", "body": CANARY, "confirmed": False},
    )
    assert result["success"] is True
    assert observed[0][1]["confirmed"] is False
    assert observed[1][1]["matched_canary_fingerprints"] == [CANARY_FP]
