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


from src.agents.coordinator_simple import (
    SimpleCoordinator as AgentCoordinator,
)
from src.models.message import MessageAnalysisRequest, MessageAnalysisResponse
from dotenv import load_dotenv

load_dotenv()

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
agent_coordinator: AgentCoordinator = None


@app.on_event("startup")
async def startup_event():
    """アプリケーション起動時の初期化"""
    global agent_coordinator
    try:
        logger.info("Initializing SafeComm ADK Backend...")
        agent_coordinator = AgentCoordinator()
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

        logger.info(result)

        return MessageAnalysisResponse(**result)

    except Exception as e:
        logger.error(f"Message analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/policy-check")
async def policy_check(request: MessageAnalysisRequest):
    """ポリシーチェック専用API"""
    try:
        logger.info(f"Checking policy compliance for user: {request.user_id}")

        # Agent Coordinatorでポリシーチェック
        result = await agent_coordinator.route_request(
            request_type="policy_check", data=request.dict()
        )
        logger.info(result)

        return result

    except Exception as e:
        logger.error(f"Policy check failed: {e}")
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


@app.post("/api/preview-message")
async def preview_message(request: MessageAnalysisRequest):
    """メッセージプレビュー分析API（軽量版）"""
    try:
        logger.info(f"Previewing message from user: {request.user_id}")

        # Agent Coordinatorでポリシーチェックのみ実行（軽量版）
        result = await agent_coordinator.route_request(
            request_type="policy_check", data=request.dict()
        )

        # ポリシーチェック結果を解析
        is_compliant = result.get("compliant", True)
        violation_detected = result.get("violation_detected", False)
        severity = result.get("severity", "")

        # プレビュー用のレスポンス形式
        preview_response = {
            "has_warnings": severity in ["low", "medium"]
            and violation_detected,
            "has_violations": severity == "high" and violation_detected,
            "preview_warnings": (
                [result.get("explanation", "")]
                if severity in ["low", "medium"] and violation_detected
                else []
            ),
            "preview_violations": (
                [result.get("explanation", "")]
                if severity == "high" and violation_detected
                else []
            ),
            "suggestion": _generate_preview_suggestion(result),
            "compliant": is_compliant,
            "violation_type": result.get("violation_type", ""),
            "explanation": result.get("explanation", ""),
        }

        return preview_response

    except Exception as e:
        logger.error(f"Message preview failed: {e}")
        return {
            "has_warnings": False,
            "has_violations": False,
            "preview_warnings": [],
            "preview_violations": [],
            "suggestion": "メッセージを送信できます",
            "compliant": True,
            "violation_type": "",
            "explanation": f"Error: {str(e)}",
        }


def _generate_preview_suggestion(analysis_result: Dict[str, Any]) -> str:
    """プレビュー用の提案メッセージ生成"""
    violation_detected = analysis_result.get("violation_detected", False)
    severity = analysis_result.get("severity", "")

    if violation_detected and severity == "high":
        return "⚠️ このメッセージには問題が含まれている可能性があります。内容を確認してください。"
    elif violation_detected and severity in ["low", "medium"]:
        return "💡 より適切な表現を検討することをお勧めします。"
    else:
        return "✅ メッセージを送信できます"


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
