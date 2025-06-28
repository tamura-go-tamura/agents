"""
設定管理
"""

import os
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """アプリケーション設定"""

    # Google Cloud設定
    google_cloud_project: str = os.getenv(
        "GOOGLE_CLOUD_PROJECT", "llm-dx-test-387511"
    )
    google_cloud_location: str = os.getenv(
        "GOOGLE_CLOUD_LOCATION", "asia-northeast1"
    )

    # ADK設定
    adk_config_path: str = os.getenv(
        "ADK_CONFIG_PATH", "/code/config/adk_config.json"
    )
    adk_session_ttl: int = int(os.getenv("ADK_SESSION_TTL", "3600"))

    # Gemini API設定
    gemini_model: str = "gemini-2.0-flash-exp"
    gemini_temperature: float = 0.1
    gemini_max_output_tokens: int = 1024

    # データベース設定
    firestore_database: str = os.getenv(
        "FIRESTORE_DATABASE", "safecomm-policies"
    )
    firestore_collection: str = os.getenv(
        "FIRESTORE_COLLECTION", "company_policies"
    )

    # API設定
    api_rate_limit: int = int(os.getenv("API_RATE_LIMIT", "100"))
    websocket_max_connections: int = int(
        os.getenv("WEBSOCKET_MAX_CONNECTIONS", "1000")
    )

    # セキュリティ設定
    jwt_secret_key: str = os.getenv(
        "JWT_SECRET_KEY", "demo-secret-key-for-hackathon"
    )
    allowed_origins: list = [
        "http://localhost:3000",
        "https://safecomm-demo.vercel.app",
    ]

    # デバッグ設定
    debug: bool = os.getenv("DEBUG", "true").lower() == "true"
    log_level: str = os.getenv("LOG_LEVEL", "INFO")

    model_config = {"env_file": ".env", "extra": "ignore"}
