"""Durable asynchronous coordinator for owner-scoped adaptive red-team runs."""
from __future__ import annotations

import threading
from secrets import randbits
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor
from pathlib import Path

from backend.app.config import settings
from backend.app.domain.redteam_run import (
    CreateRedTeamConnectionRequest,
    CreateRedTeamRunRequest,
    RedTeamConnection,
    RedTeamRun,
)
from backend.app.persistence.redteam_store import SQLiteRedTeamStore
from backend.app.redteam.mutator import STRATEGIES, AttackMutator
from backend.app.services.redteam_adapter import (
    FIXTURE_ADAPTER_ENDPOINT,
    HttpRedTeamAdapter,
    InProcessFixtureRedTeamAdapter,
)
from backend.app.services.redteam_runtime import redteam_conclusion, summarize_outcomes


class RedTeamNotFoundError(LookupError):
    pass


class RedTeamReportNotReadyError(RuntimeError):
    pass


class RedTeamConnectionBusyError(RuntimeError):
    pass


class RedTeamCoordinator:
    def __init__(
        self,
        *,
        database_path: str | Path,
        adapter_factory: Callable[[str], HttpRedTeamAdapter] = HttpRedTeamAdapter,
        start_worker: bool = True,
    ) -> None:
        self.store = SQLiteRedTeamStore(database_path)
        self._adapter_factory = adapter_factory
        self._executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="redteam")
        self._futures: dict[str, Future[None]] = {}
        self._futures_lock = threading.Lock()
        self._start_worker = start_worker

    def close(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)

    def _adapter_for_endpoint(self, endpoint: str):
        if endpoint == FIXTURE_ADAPTER_ENDPOINT:
            if not (settings.debug and settings.redteam_fixture_adapter_enabled):
                raise ValueError(
                    "The in-process fixture adapter requires DEBUG=true and "
                    "REDTEAM_FIXTURE_ADAPTER_ENABLED=true."
                )
            return InProcessFixtureRedTeamAdapter(endpoint)
        return self._adapter_factory(endpoint)

    def create_connection(self, owner_id: str, request: CreateRedTeamConnectionRequest) -> RedTeamConnection:
        adapter = self._adapter_for_endpoint(request.endpoint)
        metadata = adapter.verify()
        return self.store.create_connection(
            owner_id=owner_id,
            agent_id=request.agent_id,
            endpoint=adapter.endpoint,
            auth_reference=request.auth_reference,
            adapter_metadata=metadata,
        )

    def list_connections(self, owner_id: str, agent_id: str | None = None) -> list[RedTeamConnection]:
        return self.store.list_connections(owner_id=owner_id, agent_id=agent_id)

    def create_run(self, owner_id: str, request: CreateRedTeamRunRequest) -> RedTeamRun:
        connection = self.store.get_connection(request.connection_id, owner_id=owner_id)
        if connection is None:
            raise RedTeamNotFoundError("Red-team connection was not found.")
        if any(item.status in {"queued", "running"} and item.connection_id == connection.connection_id for item in self.store.list_runs(owner_id=owner_id)):
            raise RedTeamConnectionBusyError("This adapter already has an active red-team run.")
        run = self.store.create_run(
            owner_id=owner_id,
            agent_id=connection.agent_id,
            connection_id=connection.connection_id,
            random_seed=randbits(63),
            adapter_metadata_snapshot=connection.adapter_metadata,
            config=request.config,
        )
        self.store.append_event(run.run_id, "RUN_CREATED", {"agent_id": run.agent_id, "connection_id": run.connection_id})
        if self._start_worker:
            with self._futures_lock:
                self._futures[run.run_id] = self._executor.submit(self.process, run.run_id, owner_id)
        return self.get_run(run.run_id, owner_id)

    def get_run(self, run_id: str, owner_id: str) -> RedTeamRun:
        run = self.store.get_run(run_id, owner_id=owner_id)
        if run is None:
            raise RedTeamNotFoundError("Red-team run was not found.")
        return run

    def list_runs(self, owner_id: str) -> list[RedTeamRun]:
        return self.store.list_runs(owner_id=owner_id)

    def list_events(self, run_id: str, owner_id: str, after_seq: int):
        self.get_run(run_id, owner_id)
        return self.store.list_events(run_id, after_seq=after_seq, owner_id=owner_id)

    def get_report(self, run_id: str, owner_id: str) -> dict:
        run = self.get_run(run_id, owner_id)
        report = self.store.get_report(run_id, owner_id=owner_id)
        if report is None:
            if run.status == "failed":
                raise RedTeamReportNotReadyError(run.error_message or "Red-team run failed.")
            raise RedTeamReportNotReadyError("Red-team report is not ready.")
        return report

    def process(self, run_id: str, owner_id: str) -> None:
        """Run one connection serially and persist every replayable state transition."""
        run = self.get_run(run_id, owner_id)
        connection = self.store.get_connection(run.connection_id, owner_id=owner_id)
        if connection is None:
            self._fail(run_id, "The configured adapter connection no longer exists.")
            return
        try:
            from backend.app.knowledge.kb_loader import load_all_test_case_files
            from backend.scripts.run_redteam import (
                _get_risk_pattern,
                analyze_feedback,
                generate_json_report,
                select_seeds,
                select_strategies,
                update_weights,
            )

            adapter = self._adapter_factory(connection.endpoint)
            adapter.reset(run_id)
            self.store.update_run(run_id, status="running")
            self.store.append_event(run_id, "TARGET_VERIFIED", {
                "adapter_protocol": connection.adapter_metadata.get("protocol_version"),
                "environment": connection.adapter_metadata.get("environment"),
            })

            seeds = select_seeds(load_all_test_case_files(), run.config.seed_count)
            seed_ids = [str(seed["id"]) for seed in seeds]
            seed_snapshot = [
                {
                    "id": seed_id,
                    "risk_type": str(seed.get("risk_type", "")),
                    "severity": str(seed.get("severity", "MEDIUM")),
                    "tags": [str(tag) for tag in seed.get("tags", [])],
                }
                for seed, seed_id in zip(seeds, seed_ids)
            ]
            self.store.update_run(
                run_id, status="running", selected_seed_ids=seed_ids,
                selected_seed_snapshot=seed_snapshot,
            )
            self.store.append_event(run_id, "SEEDS_SELECTED", {"seed_ids": seed_ids, "count": len(seed_ids)})

            mutator = AttackMutator()
            weights = {strategy: 1.0 for strategy in STRATEGIES}
            weight_history: list[dict[str, float]] = []
            all_round_results: list[list[dict]] = []
            all_feedback: list[dict] = []

            for round_number in range(1, run.config.rounds + 1):
                weights_before = dict(weights)
                active = select_strategies(weights_before, top_k=3)
                weight_history.append(weights_before)
                self.store.update_run(run_id, status="running", current_round=round_number)
                self.store.append_event(run_id, "ROUND_STARTED", {"round": round_number})
                self.store.append_event(run_id, "STRATEGIES_SELECTED", {
                    "round": round_number, "strategies": active, "weights_before": weights_before,
                })
                variants = mutator.mutate_batch(seeds, active, variants_per_seed=run.config.variants_per_seed)
                results: list[dict] = []
                for variant in variants:
                    strategy = next((name for name in STRATEGIES if f"_{name}_" in variant["id"]), "unknown")
                    seed_id = variant["id"][len("tc_rt_"):].rsplit(f"_{strategy}_", 1)[0] if strategy != "unknown" else variant["id"]
                    self.store.append_event(run_id, "VARIANT_CREATED", {
                        "round": round_number, "variant_id": variant["id"], "seed_id": seed_id, "strategy": strategy,
                    })
                    remote = adapter.evaluate(run_id=run_id, variant=variant)
                    result = {
                        "test_case_id": variant["id"], "verdict": remote["verdict"],
                        "defense_labels": remote.get("defense_labels", []),
                        "risk_pattern": remote.get("risk_pattern") or _get_risk_pattern(variant.get("tags", []), variant.get("risk_type", "")),
                        "severity": variant.get("severity", "MEDIUM"), "duration_s": remote.get("duration_s", 0.0),
                        "tool_calls": remote.get("tool_calls", []), "_strategy": strategy, "_seed_id": seed_id,
                    }
                    results.append(result)
                    self.store.append_event(run_id, "VARIANT_EVALUATED", {
                        "round": round_number, "variant_id": result["test_case_id"], "strategy": strategy,
                        "verdict": result["verdict"], "defense_labels": result["defense_labels"],
                    })
                feedback = analyze_feedback(results)
                all_round_results.append(results)
                all_feedback.append(feedback)
                weights = update_weights(weights, feedback)
                self.store.append_event(run_id, "WEIGHTS_UPDATED", {
                    "round": round_number, "weights_after": weights,
                })

            legacy_report = generate_json_report(
                all_round_results, all_feedback, weight_history, seeds, run.agent_id, 0.0,
            )
            results = [item for batch in all_round_results for item in batch]
            outcomes = summarize_outcomes(results)
            report = legacy_report.model_dump(mode="json")
            report.update({
                "run_id": run_id,
                "random_seed": run.random_seed,
                "adapter_metadata_snapshot": run.adapter_metadata_snapshot,
                "selected_seed_snapshot": seed_snapshot,
                "outcome_summary": outcomes,
                "conclusion": redteam_conclusion(outcomes),
                "weight_snapshots": [
                    {"round": index + 1, "weights_before": before,
                     "active_strategies": select_strategies(before, top_k=3),
                     "weights_after": after}
                    for index, (before, after) in enumerate(zip(weight_history, [
                        event.payload["weights_after"]
                        for event in self.store.list_events(run_id, after_seq=0, owner_id=owner_id)
                        if event.type == "WEIGHTS_UPDATED"
                    ]))
                ],
            })
            self.store.save_report(run_id, report)
            self.store.update_run(run_id, status="completed")
            self.store.append_event(run_id, "RUN_FINISHED", {"conclusion": report["conclusion"]})
        except Exception as exc:  # noqa: BLE001 - all adapter/runner failures must become terminal run evidence
            self._fail(run_id, str(exc))

    def _fail(self, run_id: str, message: str) -> None:
        self.store.update_run(run_id, status="failed", error_message=message)
        self.store.append_event(run_id, "RUN_FAILED", {"message": message[:500]})


_coordinator: RedTeamCoordinator | None = None


def configure(*, database_path: str | Path, start_worker: bool = True) -> None:
    global _coordinator
    _coordinator = RedTeamCoordinator(database_path=database_path, start_worker=start_worker)


def coordinator() -> RedTeamCoordinator:
    if _coordinator is None:
        raise RuntimeError("Red-team service has not been configured")
    return _coordinator


def shutdown() -> None:
    global _coordinator
    if _coordinator is not None:
        _coordinator.close()
        _coordinator = None
