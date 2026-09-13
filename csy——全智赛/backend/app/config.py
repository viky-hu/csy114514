"""Application configuration from environment variables."""
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "CorpSec Platform"
    app_version: str = "0.1.0"
    debug: bool = False
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    trace_fingerprint_key: str | None = None
    evaluation_database_path: Path = (
        Path(__file__).resolve().parents[1] / "data" / "evaluations.sqlite3"
    )
    redteam_database_path: Path = (
        Path(__file__).resolve().parents[1] / "data" / "redteam.sqlite3"
    )
    redteam_bff_signing_secret: str | None = None
    # In-process fixture adapters are strictly local development aids.
    redteam_fixture_adapter_enabled: bool = False
    # Stage 3: LLM configuration (SiliconFlow / DeepSeek / any OpenAI-compatible)
    deepseek_api_key: str | None = None
    llm_model: str = "MiniMaxAI/MiniMax-M2.5"
    llm_base_url: str = "https://api.siliconflow.cn/v1"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
