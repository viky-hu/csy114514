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
    # Stage 3: DeepSeek LLM configuration
    deepseek_api_key: str | None = None
    llm_model: str = "deepseek-chat"
    llm_base_url: str = "https://api.deepseek.com"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
