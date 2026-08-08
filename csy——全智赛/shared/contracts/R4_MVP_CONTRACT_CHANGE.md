# R4 MVP Contract Change Record

Date: 2026-08-08
Status: APPROVED
Approval: Three owners confirmed in writing in the implementation task before contract edits.

## Changes

- Add optional `TestCase.scenario.turns[]` with `turn_id`, `input`, and
  `starts_new_session`.
- Freeze the EvaluationRun state machine and recovery metadata.
- Add six ExecutionEvent types and strict payloads for preflight, Agent,
  tool-result, and run-failure events.
- Add optional `RiskFinding.rule_types` and `RiskFinding.remediation`.
- Add recomputable `EvaluationReport.score_breakdown` for `r4-mvp-v1`.

## Compatibility

- Test cases without `scenario.turns` continue to execute top-level `input`.
- Existing event types remain valid.
- New Finding fields are optional.

## Affected Modules

- `shared/contracts` and `shared/examples/security`
- `backend/app/domain`, API, runner, sandbox, judge, persistence, and tests
- `apps/main-platform` generated OpenAPI types, BFF, Run, and Report views
