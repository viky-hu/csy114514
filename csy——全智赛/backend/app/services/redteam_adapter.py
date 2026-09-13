"""Controlled HTTP adapter for user-owned red-team targets."""
from __future__ import annotations

import ipaddress
import socket
from typing import Any
from urllib.parse import urlparse

import httpx


class InvalidAdapterEndpoint(ValueError):
    """The configured endpoint violates the test-target network policy."""


class AdapterProtocolError(RuntimeError):
    """The remote target did not satisfy the Red Team Adapter v1 contract."""

FIXTURE_ADAPTER_ENDPOINT = "fixture://redteam-v1"


class InProcessFixtureRedTeamAdapter:
    """Deterministic Adapter v1 fixture for explicitly enabled debug sessions only."""

    def __init__(self, endpoint: str) -> None:
        if endpoint != FIXTURE_ADAPTER_ENDPOINT:
            raise InvalidAdapterEndpoint("Unknown in-process fixture adapter endpoint.")
        self.endpoint = endpoint

    def verify(self) -> dict[str, Any]:
        return {
            "protocol_version": "v1",
            "environment": "test",
            "supports_reset": True,
            "adapter_kind": "in_process_fixture",
        }

    def reset(self, run_id: str) -> None:
        return None

    def evaluate(self, *, run_id: str, variant: dict[str, Any]) -> dict[str, Any]:
        return {
            "verdict": "PASS",
            "defense_labels": ["D1:FixtureDefense"],
            "duration_s": 0.0,
            "tool_calls": [],
        }


def _is_public_address(value: str) -> bool:
    address = ipaddress.ip_address(value)
    return not (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
    )


def validate_adapter_endpoint(endpoint: str) -> str:
    """Reject non-HTTPS and literal private-network adapter endpoints."""
    parsed = urlparse(endpoint)
    if parsed.scheme != "https" or not parsed.hostname:
        raise InvalidAdapterEndpoint("Adapter endpoint must use HTTPS and include a hostname.")
    try:
        literal_address = ipaddress.ip_address(parsed.hostname)
    except ValueError:
        # Hostnames are resolved immediately before network requests so DNS
        # rebinding cannot turn a verified public name into a private target.
        pass
    else:
        if not _is_public_address(str(literal_address)):
            raise InvalidAdapterEndpoint("Adapter endpoint must not target a private address.")
    return endpoint.rstrip("/")


def validate_resolved_adapter_host(hostname: str) -> None:
    """Resolve and reject a hostname that maps to any non-public address."""
    try:
        addresses = socket.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise InvalidAdapterEndpoint("Adapter hostname could not be resolved.") from exc
    if not addresses or any(not _is_public_address(item[4][0]) for item in addresses):
        raise InvalidAdapterEndpoint("Adapter hostname resolves to a private address.")


class HttpRedTeamAdapter:
    """Small Adapter v1 client with no redirect or unbounded-response escape hatch."""

    def __init__(self, endpoint: str, *, timeout_s: float = 20.0) -> None:
        self.endpoint = validate_adapter_endpoint(endpoint)
        self.timeout_s = timeout_s

    def _request(self, method: str, path: str, *, json_body: dict[str, Any] | None = None) -> dict[str, Any]:
        parsed = urlparse(self.endpoint)
        assert parsed.hostname is not None
        validate_resolved_adapter_host(parsed.hostname)
        with httpx.Client(timeout=self.timeout_s, follow_redirects=False) as client:
            response = client.request(method, f"{self.endpoint}{path}", json=json_body)
        if 300 <= response.status_code < 400:
            raise AdapterProtocolError("Adapter redirects are not permitted.")
        response.raise_for_status()
        if len(response.content) > 1_000_000:
            raise AdapterProtocolError("Adapter response exceeded the 1 MB limit.")
        try:
            payload = response.json()
        except ValueError as exc:
            raise AdapterProtocolError("Adapter response must be JSON.") from exc
        if not isinstance(payload, dict):
            raise AdapterProtocolError("Adapter response must be a JSON object.")
        return payload

    def verify(self) -> dict[str, Any]:
        payload = self._request("GET", "/.well-known/redteam-adapter")
        if payload.get("protocol_version") != "v1" or payload.get("environment") != "test":
            raise AdapterProtocolError("Adapter must declare protocol v1 and environment=test.")
        if payload.get("supports_reset") is not True:
            raise AdapterProtocolError("Adapter must support session reset.")
        return payload

    def reset(self, run_id: str) -> None:
        self._request("POST", "/v1/redteam/reset", json_body={"run_id": run_id})

    def evaluate(self, *, run_id: str, variant: dict[str, Any]) -> dict[str, Any]:
        payload = self._request(
            "POST",
            "/v1/redteam/evaluate",
            json_body={"run_id": run_id, "test_case": variant},
        )
        verdict = payload.get("verdict")
        labels = payload.get("defense_labels", [])
        if verdict not in {"PASS", "FAIL", "ERROR"} or not isinstance(labels, list):
            raise AdapterProtocolError("Adapter result must contain verdict and defense_labels.")
        return payload
