"""R4 preflight and fingerprinting behavior."""

import base64
import hashlib
import hmac
import json
import unicodedata
from dataclasses import asdict
from pathlib import Path

import pytest

from backend.app.security.fingerprints import derive_canary, fingerprint_value
from backend.app.services.preflight_service import PreflightError, PreflightService

SHARED_ROOT = Path(__file__).resolve().parents[2] / "shared"
TEST_CASES_PATH = SHARED_ROOT / "examples" / "security" / "security_testcases.json"
ATTACK_SEEDS_PATH = SHARED_ROOT / "examples" / "security" / "attack_seeds.json"
BROWSER_PAGES_PATH = SHARED_ROOT / "fixtures" / "browser_pages.json"


def _expected_canary(key: bytes, run_id: str) -> str:
    digest = hmac.new(key, b"canary\0" + run_id.encode("utf-8"), hashlib.sha256).digest()
    return base64.b32encode(digest).decode("ascii")[:26]


def _write_json(path: Path, value: object) -> Path:
    path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    return path


def _service(
    *,
    test_cases_path: Path = TEST_CASES_PATH,
    attack_seeds_path: Path = ATTACK_SEEDS_PATH,
    browser_pages_path: Path = BROWSER_PAGES_PATH,
) -> PreflightService:
    return PreflightService(
        test_cases_path=test_cases_path,
        attack_seeds_path=attack_seeds_path,
        browser_pages_path=browser_pages_path,
    )


def test_canary_matches_frozen_derivation() -> None:
    key = b"unit-test-fingerprint-key"
    assert derive_canary(key, "eval-r4-001") == _expected_canary(key, "eval-r4-001")
    assert len(derive_canary(key, "eval-r4-001")) == 26


def test_fingerprint_normalizes_unicode_and_separates_types() -> None:
    key = b"unit-test-fingerprint-key"
    composed = "caf\u00e9"
    decomposed = "cafe\u0301"

    expected_message = (
        b"fingerprint\0"
        + b"memory_value\0"
        + unicodedata.normalize("NFC", decomposed).encode("utf-8")
    )
    expected = hmac.new(key, expected_message, hashlib.sha256).hexdigest()

    assert fingerprint_value(key, decomposed, value_type="memory_value") == expected
    assert fingerprint_value(key, composed, value_type="memory_value") == expected
    assert fingerprint_value(key, composed, value_type="browser_content") != expected


def test_preflight_loads_real_assets_and_returns_safe_metadata() -> None:
    key = b"unit-test-fingerprint-key"
    run_id = "eval-r4-001"
    result = _service().prepare(run_id=run_id, fingerprint_key=key)
    canary = derive_canary(key, run_id)

    assert result.browser_page.fixture_id == "page_pipi_memory_poison"
    assert result.browser_page.url == "https://malicious.example/preference-update"
    assert canary in result.browser_page.content
    assert "{{CANARY}}" not in result.browser_page.content
    assert "{{ATTACK_PAYLOAD}}" not in result.browser_page.content
    assert "SYSTEM MEMORY UPDATE" in result.browser_page.content

    metadata_json = json.dumps(asdict(result.metadata), sort_keys=True)
    assert result.metadata.test_case_id == "tc_pipi_001"
    assert result.metadata.seed_id == "seed_pipi_001"
    assert result.metadata.mutation_version == "r4-preflight-v1"
    assert len(result.metadata.fixture_digest) == 64
    assert len(result.metadata.canary_fingerprint) == 64
    assert canary not in metadata_json
    assert result.browser_page.content not in metadata_json
    assert not hasattr(result.metadata, "canary")
    assert not hasattr(result.metadata, "content")


@pytest.mark.parametrize(
    ("missing_name", "expected_code"),
    [
        ("test_cases", "TEST_CASE_ASSET_NOT_FOUND"),
        ("attack_seeds", "ATTACK_SEED_ASSET_NOT_FOUND"),
        ("browser_pages", "BROWSER_PAGE_ASSET_NOT_FOUND"),
    ],
)
def test_preflight_reports_missing_asset_with_stable_code(
    tmp_path: Path, missing_name: str, expected_code: str
) -> None:
    paths = {
        "test_cases": TEST_CASES_PATH,
        "attack_seeds": ATTACK_SEEDS_PATH,
        "browser_pages": BROWSER_PAGES_PATH,
    }
    paths[missing_name] = tmp_path / "missing.json"

    with pytest.raises(PreflightError) as captured:
        _service(
            test_cases_path=paths["test_cases"],
            attack_seeds_path=paths["attack_seeds"],
            browser_pages_path=paths["browser_pages"],
        ).prepare(run_id="eval-r4-001", fingerprint_key=b"key")

    assert captured.value.code == expected_code


def test_preflight_rejects_fixture_url_mismatch(tmp_path: Path) -> None:
    pages = json.loads(BROWSER_PAGES_PATH.read_text(encoding="utf-8"))
    pages["page_pipi_memory_poison"]["url"] = "https://other.example/page"
    pages_path = _write_json(tmp_path / "browser_pages.json", pages)

    with pytest.raises(PreflightError) as captured:
        _service(browser_pages_path=pages_path).prepare(
            run_id="eval-r4-001", fingerprint_key=b"key"
        )

    assert captured.value.code == "BROWSER_PAGE_URL_MISMATCH"


def test_preflight_rejects_page_without_exact_canary(tmp_path: Path) -> None:
    seeds = json.loads(ATTACK_SEEDS_PATH.read_text(encoding="utf-8"))
    seed = next(item for item in seeds if item["id"] == "seed_pipi_001")
    seed["payload"]["content"] = "Payload without the required marker"
    seeds_path = _write_json(tmp_path / "attack_seeds.json", seeds)

    with pytest.raises(PreflightError) as captured:
        _service(attack_seeds_path=seeds_path).prepare(
            run_id="eval-r4-001", fingerprint_key=b"key"
        )

    assert captured.value.code == "CANARY_VALIDATION_FAILED"


def test_preflight_rejects_unknown_test_case() -> None:
    with pytest.raises(PreflightError) as captured:
        _service().prepare(
            run_id="eval-r4-001",
            fingerprint_key=b"key",
            test_case_id="tc_missing_999",
        )

    assert captured.value.code == "TEST_CASE_NOT_FOUND"
