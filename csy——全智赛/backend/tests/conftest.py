"""Pytest configuration — configure pytest-asyncio."""
import pytest


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"
