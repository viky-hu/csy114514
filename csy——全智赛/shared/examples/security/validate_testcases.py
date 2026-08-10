"""Validate all TestCase files against schema v1.1.

Usage:
    python shared/examples/security/validate_testcases.py

Exit code 0 = all pass, 1 = errors found.
"""
import json
import sys
from pathlib import Path


def load_json(path: Path) -> dict | list:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def validate_testcase(tc: dict, schema: dict, source: str) -> list[str]:
    errors = []
    tc_id = tc.get("id", "???")
    required = schema["required"]
    allowed = set(schema["properties"].keys())

    for field in required:
        if field not in tc:
            errors.append(f"  {source}/{tc_id}: missing required '{field}'")

    for field in tc:
        if field not in allowed:
            errors.append(f"  {source}/{tc_id}: unknown field '{field}'")

    has_input = tc.get("input") is not None
    has_turns = bool(tc.get("scenario", {}).get("turns"))
    if not has_input and not has_turns:
        errors.append(f"  {source}/{tc_id}: must have input or scenario.turns")

    if has_turns:
        for j, turn in enumerate(tc["scenario"]["turns"]):
            for req in ["turn_id", "input", "starts_new_session"]:
                if req not in turn:
                    errors.append(f"  {source}/{tc_id} turn[{j}]: missing '{req}'")
            env = turn.get("env_delta")
            if env is not None:
                for k in env:
                    if k not in ("browser_pages", "memory", "email_inbox"):
                        errors.append(f"  {source}/{tc_id} turn[{j}]: bad env_delta '{k}'")
    return errors


def main():
    root = Path(__file__).resolve().parent.parent.parent.parent
    schema_path = root / "shared" / "contracts" / "test_case.schema.json"
    tc_dir = Path(__file__).resolve().parent

    if not schema_path.exists():
        print(f"Schema not found: {schema_path}")
        sys.exit(1)

    schema = load_json(schema_path)
    tc_files = sorted(tc_dir.glob("security_testcases*.json"))

    all_errors = []
    total = 0
    by_file = {}

    for tc_file in tc_files:
        testcases = load_json(tc_file)
        fname = tc_file.name
        count = len(testcases)
        total += count
        errors = []
        for tc in testcases:
            errors.extend(validate_testcase(tc, schema, fname))
        by_file[fname] = (count, errors)
        all_errors.extend(errors)

    print(f"TestCase Schema Validation (v1.1)")
    print(f"{'=' * 50}")
    for fname, (count, errors) in by_file.items():
        status = "PASS" if not errors else "FAIL"
        print(f"  {fname}: {count} testcases [{status}]")
    print(f"{'=' * 50}")
    print(f"Total: {total} testcases")

    if all_errors:
        print(f"\nERRORS ({len(all_errors)}):")
        for e in all_errors:
            print(e)
        sys.exit(1)
    else:
        print(f"\nALL PASSED")
        sys.exit(0)


if __name__ == "__main__":
    main()
