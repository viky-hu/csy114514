"""Real R4 preflight: resolve, mutate, and validate the browser payload."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from backend.app.domain.attack_seed import AttackSeed
from backend.app.domain.test_case import TestCase
from backend.app.security.fingerprints import derive_canary, fingerprint_value

_DEFAULT_SHARED_ROOT = Path(__file__).resolve().parents[3] / "shared"
_MUTATION_VERSION = "r4-preflight-v1"


class PreflightError(Exception):
    """Expected preflight failure with a stable machine-readable code."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        details: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}


@dataclass(frozen=True, slots=True)
class MutatedBrowserPage:
    """Ephemeral page object intended only for this run's Sandbox registration."""

    fixture_id: str
    url: str
    title: str
    content: str


@dataclass(frozen=True, slots=True)
class PreflightMetadata:
    """Safe-to-persist context required to rebuild and verify a run."""

    test_case_id: str
    seed_id: str
    fixture_id: str
    target_url: str
    mutation_version: str
    fixture_digest: str
    canary_fingerprint: str


@dataclass(frozen=True, slots=True)
class PreflightResult:
    metadata: PreflightMetadata
    browser_page: MutatedBrowserPage


class PreflightService:
    """Prepare the single R4 MVP test from canonical shared assets."""

    def __init__(
        self,
        *,
        test_cases_path: Path | None = None,
        attack_seeds_path: Path | None = None,
        browser_pages_path: Path | None = None,
    ) -> None:
        self._test_cases_path = test_cases_path or (
            _DEFAULT_SHARED_ROOT / "examples" / "security" / "security_testcases.json"
        )
        self._attack_seeds_path = attack_seeds_path or (
            _DEFAULT_SHARED_ROOT / "examples" / "security" / "attack_seeds.json"
        )
        self._browser_pages_path = browser_pages_path or (
            _DEFAULT_SHARED_ROOT / "fixtures" / "browser_pages.json"
        )

    def prepare(
        self,
        *,
        run_id: str,
        fingerprint_key: str | bytes,
        test_case_id: str = "tc_pipi_001",
    ) -> PreflightResult:
        test_cases_data = self._load_json(
            self._test_cases_path, "TEST_CASE_ASSET_NOT_FOUND", "TEST_CASE_ASSET_INVALID"
        )
        seeds_data = self._load_json(
            self._attack_seeds_path,
            "ATTACK_SEED_ASSET_NOT_FOUND",
            "ATTACK_SEED_ASSET_INVALID",
        )
        pages_data = self._load_json(
            self._browser_pages_path,
            "BROWSER_PAGE_ASSET_NOT_FOUND",
            "BROWSER_PAGE_ASSET_INVALID",
        )

        test_case_raw = self._find_by_id(test_cases_data, test_case_id)
        if test_case_raw is None:
            raise PreflightError(
                "TEST_CASE_NOT_FOUND",
                "Requested test case was not found",
                details={"test_case_id": test_case_id},
            )
        test_case = self._validate_test_case(test_case_raw, test_case_id)

        if len(test_case.attack_seed_ids) != 1:
            raise PreflightError(
                "ATTACK_SEED_REFERENCE_INVALID",
                "R4 preflight requires exactly one attack seed",
                details={"test_case_id": test_case.id},
            )
        seed_id = test_case.attack_seed_ids[0]
        seed_raw = self._find_by_id(seeds_data, seed_id)
        if seed_raw is None:
            raise PreflightError(
                "ATTACK_SEED_NOT_FOUND",
                "Referenced attack seed was not found",
                details={"seed_id": seed_id},
            )
        seed = self._validate_seed(seed_raw, seed_id)

        browser_pages = test_case.scenario.initial_state.browser_pages
        if len(browser_pages) != 1:
            raise PreflightError(
                "BROWSER_PAGE_REFERENCE_INVALID",
                "R4 preflight requires exactly one browser page",
                details={"test_case_id": test_case.id},
            )
        target_url, fixture_id = next(iter(browser_pages.items()))
        page = self._page_fixture(pages_data, fixture_id)
        if page["url"] != target_url:
            raise PreflightError(
                "BROWSER_PAGE_URL_MISMATCH",
                "Browser page URL does not match the test case mapping",
                details={"fixture_id": fixture_id},
            )

        canary = derive_canary(fingerprint_key, run_id)
        if "{{CANARY}}" not in seed.payload.content:
            raise PreflightError(
                "CANARY_VALIDATION_FAILED",
                "Attack seed does not contain the required canary placeholder",
                details={"seed_id": seed.id},
            )
        if "{{ATTACK_PAYLOAD}}" not in page["content_template"]:
            raise PreflightError(
                "PAGE_MUTATION_FAILED",
                "Browser page does not contain the attack payload placeholder",
                details={"fixture_id": fixture_id},
            )

        attack_payload = seed.payload.content.replace("{{CANARY}}", canary)
        content = page["content_template"].replace("{{ATTACK_PAYLOAD}}", attack_payload)
        if canary not in content or "{{CANARY}}" in content:
            raise PreflightError(
                "CANARY_VALIDATION_FAILED",
                "Mutated browser page does not contain the exact run canary",
                details={"fixture_id": fixture_id},
            )
        if "{{ATTACK_PAYLOAD}}" in content:
            raise PreflightError(
                "PAGE_MUTATION_FAILED",
                "Browser page attack payload placeholder was not replaced",
                details={"fixture_id": fixture_id},
            )

        browser_page = MutatedBrowserPage(
            fixture_id=fixture_id,
            url=target_url,
            title=page["title"],
            content=content,
        )
        digest_source = json.dumps(
            {
                "fixture_id": fixture_id,
                "url": target_url,
                "title": page["title"],
                "content": content,
            },
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        metadata = PreflightMetadata(
            test_case_id=test_case.id,
            seed_id=seed.id,
            fixture_id=fixture_id,
            target_url=target_url,
            mutation_version=_MUTATION_VERSION,
            fixture_digest=hashlib.sha256(digest_source).hexdigest(),
            canary_fingerprint=fingerprint_value(
                fingerprint_key, canary, value_type="canary"
            ),
        )
        return PreflightResult(metadata=metadata, browser_page=browser_page)

    @staticmethod
    def _load_json(path: Path, missing_code: str, invalid_code: str) -> Any:
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError as exc:
            raise PreflightError(missing_code, "Required preflight asset was not found") from exc
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            raise PreflightError(invalid_code, "Required preflight asset is invalid") from exc

    @staticmethod
    def _find_by_id(items: Any, item_id: str) -> dict[str, Any] | None:
        if not isinstance(items, list):
            return None
        return next(
            (
                item
                for item in items
                if isinstance(item, dict) and item.get("id") == item_id
            ),
            None,
        )

    @staticmethod
    def _validate_test_case(raw: dict[str, Any], test_case_id: str) -> TestCase:
        try:
            return TestCase.model_validate(raw)
        except ValidationError as exc:
            raise PreflightError(
                "TEST_CASE_INVALID",
                "Requested test case failed contract validation",
                details={"test_case_id": test_case_id},
            ) from exc

    @staticmethod
    def _validate_seed(raw: dict[str, Any], seed_id: str) -> AttackSeed:
        try:
            return AttackSeed.model_validate(raw)
        except ValidationError as exc:
            raise PreflightError(
                "ATTACK_SEED_INVALID",
                "Referenced attack seed failed contract validation",
                details={"seed_id": seed_id},
            ) from exc

    @staticmethod
    def _page_fixture(pages: Any, fixture_id: str) -> dict[str, str]:
        if not isinstance(pages, dict) or fixture_id not in pages:
            raise PreflightError(
                "BROWSER_PAGE_NOT_FOUND",
                "Referenced browser page fixture was not found",
                details={"fixture_id": fixture_id},
            )
        page = pages[fixture_id]
        required = ("url", "title", "content_template")
        if not isinstance(page, dict) or any(
            not isinstance(page.get(field), str) or not page[field]
            for field in required
        ):
            raise PreflightError(
                "BROWSER_PAGE_INVALID",
                "Referenced browser page fixture is invalid",
                details={"fixture_id": fixture_id},
            )
        return {field: page[field] for field in required}
