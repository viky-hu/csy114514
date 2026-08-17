"""D14: 全量 72 条 TestCase 批量执行端到端验证.

验证:
  1. 所有 TestCase 加载成功
  2. 批量创建 + 启动 + 执行完成
  3. 每条 TestCase 有 TEST_STARTED + TEST_COMPLETED + JUDGE_DECISION 事件
  4. ReportSummary 统计正确
  5. SQLite 持久化正常
"""
import os

import pytest

os.environ.setdefault("TRACE_FINGERPRINT_KEY", "test-validation-key")

from backend.app.knowledge.kb_loader import load_all_test_case_files
from backend.app.services import evaluation_service


@pytest.fixture(autouse=True)
def setup_service(tmp_path):
    evaluation_service.shutdown()
    evaluation_service.configure(
        database_path=str(tmp_path / "test.db"),
        fingerprint_key="test-validation-key",
        start_worker=False,
    )
    yield
    evaluation_service.shutdown()


def test_all_test_cases_load():
    """所有 72 条 TestCase 能成功加载."""
    tcs = load_all_test_case_files()
    assert len(tcs) >= 72, f"Expected >= 72 test cases, got {len(tcs)}"


def test_full_batch_execution():
    """72 条 TestCase 全量批量执行: 创建→启动→执行→完成."""
    tcs = load_all_test_case_files()
    all_ids = [tc["id"] for tc in tcs]
    coordinator = evaluation_service.coordinator()

    # 1. 创建
    run, created = coordinator.create(
        request_id="full-batch-validation",
        agent_id="corpmate-v0",
        test_case_ids=all_ids,
    )
    assert created, "Evaluation should be newly created"
    assert run.status == "ready"
    assert run.test_case_ids == all_ids

    # 2. 启动
    run, _ = coordinator.start(run.run_id)
    assert run.status == "queued"

    # 3. 执行
    coordinator.process_queued_once()

    # 4. 检查结果
    run = coordinator.get(run.run_id)
    assert run.status == "completed", f"Expected completed, got {run.status} (error: {run.error})"

    # 5. 检查 Trace 事件
    trace = coordinator.get_trace(run.run_id)
    test_started = [e for e in trace.events if e.type == "TEST_STARTED"]
    test_completed = [e for e in trace.events if e.type == "TEST_COMPLETED"]
    judge_decisions = [e for e in trace.events if e.type == "JUDGE_DECISION"]

    assert len(test_started) == len(all_ids), f"Expected {len(all_ids)} TEST_STARTED, got {len(test_started)}"
    assert len(test_completed) == len(all_ids), f"Expected {len(all_ids)} TEST_COMPLETED, got {len(test_completed)}"
    assert len(judge_decisions) == len(all_ids), f"Expected {len(all_ids)} JUDGE_DECISION, got {len(judge_decisions)}"

    # 6. 检查每条 TestCase 的 test_case_id 字段
    started_ids = {e.payload["test_case_id"] for e in test_started}
    completed_ids = {e.payload["test_case_id"] for e in test_completed}
    assert started_ids == set(all_ids), "TEST_STARTED should cover all test cases"
    assert completed_ids == set(all_ids), "TEST_COMPLETED should cover all test cases"

    # 7. 检查 verdict 分布
    verdicts = [e.payload["verdict"] for e in test_completed]
    pass_count = sum(1 for v in verdicts if v == "PASS")
    fail_count = sum(1 for v in verdicts if v == "FAIL")
    error_count = sum(1 for v in verdicts if v == "ERROR")
    assert pass_count + fail_count + error_count == len(all_ids)

    # 8. 检查 Report
    report = coordinator.get_report(run.run_id)
    assert report is not None, "Report should be available"
    assert report.report_id.startswith("report-")

    # 9. 检查 ReportSummary
    assert report.summary is not None, "ReportSummary should be present"
    assert report.summary.total_tests == len(all_ids)
    assert report.summary.passed + report.summary.failed + report.summary.error == len(all_ids)
    assert 0.0 <= report.summary.pass_rate <= 1.0

    # 10. 检查统计维度
    total_by_pattern = sum(v["total"] for v in report.summary.by_risk_pattern.values())
    assert total_by_pattern == len(all_ids), f"by_risk_pattern total mismatch: {total_by_pattern}"

    total_by_type = sum(v["total"] for v in report.summary.by_risk_type.values())
    assert total_by_type == len(all_ids), f"by_risk_type total mismatch: {total_by_type}"

    total_by_severity = sum(v["total"] for v in report.summary.by_severity.values())
    assert total_by_severity == len(all_ids), f"by_severity total mismatch: {total_by_severity}"

    # 11. 打印结果摘要
    print(f"\n{'='*60}")
    print(f"Full Batch Validation — {len(all_ids)} TestCases")
    print(f"{'='*60}")
    print(f"Status: {run.status}")
    print(f"Score:  {report.overall_score}/100")
    print(f"Severity: {report.severity}")
    print(f"Pass rate: {report.summary.pass_rate:.1%}")
    print(f"  PASS:  {pass_count}")
    print(f"  FAIL:  {fail_count}")
    print(f"  ERROR: {error_count}")
    print("\nBy RiskPattern:")
    for rp, stats in sorted(report.summary.by_risk_pattern.items()):
        print(f"  {rp:6s}  total={stats['total']:3d}  pass={stats['passed']:3d}  fail={stats['failed']:3d}")
    print("\nBy RiskType:")
    for rt, stats in sorted(report.summary.by_risk_type.items()):
        print(f"  {rt:45s}  total={stats['total']:3d}  pass={stats['passed']:3d}  fail={stats['failed']:3d}")
    print("\nBy Severity:")
    for sev, stats in sorted(report.summary.by_severity.items()):
        print(f"  {sev:10s}  total={stats['total']:3d}  pass={stats['passed']:3d}  fail={stats['failed']:3d}")
    print(f"{'='*60}")
