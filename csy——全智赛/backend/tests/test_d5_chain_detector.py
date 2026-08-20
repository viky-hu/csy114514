"""Tests for D5: ChainDetector — causal chain detection."""
from __future__ import annotations

from backend.app.agents.defenses.chain_detector import ChainDetector


class TestChainDetector:
    """Test D5 ChainDetector suspicious chain detection."""

    def setup_method(self):
        self.detector = ChainDetector()

    def test_browse_send_chain(self):
        """Detect browse → send direct chain (R1)."""
        self.detector.check_and_record("browser.open_page")
        labels = self.detector.check_and_record("email.send")
        assert "D5:browse_send_chain" in labels

    def test_browse_write_send_chain(self):
        """Detect browse → write → send full chain (R4)."""
        self.detector.check_and_record("browser.open_page")
        self.detector.check_and_record("memory.write")
        labels = self.detector.check_and_record("email.send")
        assert "D5:browse_write_send_chain" in labels

    def test_browse_write_chain(self):
        """Detect browse → write chain (R2 memory poisoning)."""
        self.detector.check_and_record("browser.open_page")
        labels = self.detector.check_and_record("memory.write")
        assert "D5:browse_write_chain" in labels

    def test_read_send_chain(self):
        """Detect email.read → send chain (R3 data exfiltration)."""
        self.detector.check_and_record("email.read")
        labels = self.detector.check_and_record("email.send")
        assert "D5:read_send_chain" in labels

    def test_no_false_positive_normal_sequence(self):
        """Normal tool sequences don't trigger chains."""
        self.detector.check_and_record("email.list")
        labels = self.detector.check_and_record("email.read")
        assert labels == []

    def test_no_false_positive_browse_then_list(self):
        """browse → email.list is not suspicious."""
        self.detector.check_and_record("browser.open_page")
        labels = self.detector.check_and_record("email.list")
        assert labels == []

    def test_reset_clears_history(self):
        """reset() clears tool history."""
        self.detector.check_and_record("browser.open_page")
        self.detector.reset()
        labels = self.detector.check_and_record("email.send")
        assert labels == []  # No chain after reset

    def test_get_history(self):
        """get_history() returns recorded tool calls."""
        self.detector.check_and_record("browser.open_page")
        self.detector.check_and_record("memory.write")
        history = self.detector.get_history()
        assert history == ["browser.open_page", "memory.write"]

    def test_multiple_chains_on_same_step(self):
        """browse → write triggers browse_write, write → send triggers read_send? No."""
        self.detector.check_and_record("browser.open_page")
        self.detector.check_and_record("memory.write")
        # browse_write detected at step 2
        # Now email.send — should detect browse_write_send (3-step)
        labels = self.detector.check_and_record("email.send")
        assert "D5:browse_write_send_chain" in labels

    def test_interrupted_chain_not_detected(self):
        """An unrelated tool between breaks the chain."""
        self.detector.check_and_record("browser.open_page")
        self.detector.check_and_record("email.list")  # interrupts browse→send
        labels = self.detector.check_and_record("email.send")
        # browse_send needs consecutive browse→send, but email.list is between
        assert "D5:browse_send_chain" not in labels
