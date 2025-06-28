"""
SafeComm ADK Backend
Google Cloud Agent Development Kit を使用したコミュニケーション監視システム
"""

from fastapi import (
    FastAPI,
    WebSocket,
    HTTPException,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
import json
import asyncio
import os
from typing import Dict, Any
import logging

# 設定
from src.config.settings import Settings
from src.agents.coordinator import AgentCoordinator
from src.models.message import MessageAnalysisRequest, MessageAnalysisResponse

# ロギング設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPIアプリケーション
app = FastAPI(
    title="SafeComm Chat Monitor API",
    description="AI-powered communication monitoring system using Google Cloud ADK",
    version="1.0.0",
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
    ],  # Next.jsフロントエンド
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 設定とAgent初期化
settings = Settings()
agent_coordinator: AgentCoordinator = None


@app.on_event("startup")
async def startup_event():
    """アプリケーション起動時の初期化"""
    global agent_coordinator
    try:
        logger.info("Initializing SafeComm ADK Backend...")
        agent_coordinator = AgentCoordinator(settings)
        await agent_coordinator.initialize()
        logger.info("SafeComm ADK Backend initialized successfully!")
    except Exception as e:
        logger.error(f"Failed to initialize ADK Backend: {e}")
        raise


@app.get("/")
async def root():
    """ルートエンドポイント"""
    return {
        "message": "SafeComm ADK Backend",
        "status": "running",
        "version": "1.0.0",
    }


# Health check endpoint
@app.get("/health")
async def health_check():
    """ヘルスチェック"""
    return {"status": "healthy", "message": "SafeComm ADK Backend is running"}


@app.post("/api/analyze-message", response_model=MessageAnalysisResponse)
async def analyze_message(request: MessageAnalysisRequest):
    """メッセージ分析API（内部サービス用）"""
    try:
        logger.info(f"Analyzing message from user: {request.user_id}")

        # Agent Coordinatorでメッセージ分析
        result = await agent_coordinator.route_request(
            request_type="chat_analysis", data=request.dict()
        )

        return MessageAnalysisResponse(**result)

    except Exception as e:
        logger.error(f"Message analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws/realtime-analysis")
async def websocket_endpoint(websocket: WebSocket):
    """リアルタイム分析WebSocket"""
    await websocket.accept()
    logger.info("WebSocket connection established")

    try:
        while True:
            # メッセージ受信
            data = await websocket.receive_text()
            request_data = json.loads(data)

            logger.info(
                f"Received realtime analysis request: {request_data.get('message', '')[:50]}..."
            )

            # リアルタイム分析実行
            result = await agent_coordinator.route_request(
                request_type="chat_analysis", data=request_data
            )

            # 結果送信
            await websocket.send_text(json.dumps(result))

    except WebSocketDisconnect:
        logger.info("WebSocket connection closed by client")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            # Try to close the connection safely
            await websocket.close(code=1000)
        except:
            # Connection might already be closed, ignore the error
            pass
    finally:
        logger.info("WebSocket connection cleanup completed")


# WebSocket接続テスト用エンドポイント
@app.get("/ws-test")
async def websocket_test():
    """WebSocket接続テスト用"""
    return {
        "websocket_url": "ws://localhost:8080/ws/realtime-analysis",
        "status": "ready",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app", host="0.0.0.0", port=8080, reload=True, log_level="info"
    )
