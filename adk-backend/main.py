"""
ADKを使用したシンプルなメッセージ分析API
"""

import asyncio
import json
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List

from google.adk.runners import InMemoryRunner
from google.adk.sessions import Session
from google.genai import types

# ADKオーケストラエージェントをインポート
from agents.message_analyzer_orchestrator import message_analyzer_orchestrator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="SafeComm ADK API", version="1.0.0")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ADK Runnerの初期化
app_name = "safecomm_multiagent_app"
runner = InMemoryRunner(
    agent=message_analyzer_orchestrator,
    app_name=app_name,
)

# セッション管理
sessions: Dict[str, Session] = {}


class MessageRequest(BaseModel):
    """メッセージ分析リクエスト"""

    message: str
    user_id: str = "default_user"
    room_id: str = ""
    timestamp: str = ""


class MessageResponse(BaseModel):
    """プロンプトベースマルチエージェント分析レスポンス"""

    risk_level: str
    confidence: float
    detected_issues: List[str]
    suggestions: List[str]
    flagged_content: List[str] = []
    processing_time_ms: float
    compliance_notes: str = ""
    detailed_analysis: Dict[str, Any] = {}


async def get_or_create_session(user_id: str) -> Session:
    """ユーザーのセッションを取得または作成"""
    if user_id not in sessions:
        sessions[user_id] = await runner.session_service.create_session(
            app_name=app_name, user_id=user_id
        )
    return sessions[user_id]


@app.get("/health")
async def health_check():
    """ヘルスチェック"""
    return {"status": "healthy", "service": "SafeComm ADK API"}


@app.post("/api/analyze-message", response_model=MessageResponse)
async def analyze_message(request: MessageRequest):
    """
    ADKマルチエージェントを使用してメッセージを分析する
    """
    try:
        logger.info(
            f"プロンプトベース・マルチエージェント分析リクエスト: {request.message[:50]}..."
        )

        # ユーザーセッションを取得
        session = await get_or_create_session(request.user_id)

        # ADKプロンプトベース・マルチエージェントに分析を依頼
        content = types.Content(
            role="user",
            parts=[
                types.Part.from_text(
                    text=f"以下のメッセージを分析してください: 「{request.message}」"
                )
            ],
        )

        # エージェントを実行
        analysis_result = None
        final_response_text = ""

        async for event in runner.run_async(
            user_id=request.user_id,
            session_id=session.id,
            new_message=content,
        ):
            # エージェントからのテキストレスポンスを取得
            if hasattr(event, "content") and event.content:
                for part in event.content.parts:
                    if hasattr(part, "text") and part.text:
                        final_response_text += part.text

        # プロンプトベースエージェントのJSONレスポンスを解析
        if final_response_text:
            try:
                # JSONの開始と終了を見つけて抽出
                json_start = final_response_text.find("{")
                json_end = final_response_text.rfind("}") + 1

                if json_start != -1 and json_end > json_start:
                    json_text = final_response_text[json_start:json_end]
                    analysis_result = json.loads(json_text)
                    logger.info(
                        f"JSON解析成功: {analysis_result.get('risk_level', 'UNKNOWN')}"
                    )
                else:
                    logger.warning(
                        "レスポンステキストにJSONが見つかりませんでした"
                    )

            except json.JSONDecodeError as e:
                logger.error(f"JSON解析エラー: {e}")
                logger.error(
                    f"レスポンステキスト: {final_response_text[:500]}..."
                )
            except Exception as e:
                logger.error(f"レスポンス処理エラー: {e}")

        # 分析結果が取得できない場合のフォールバック
        if not analysis_result:
            logger.warning(
                "プロンプトベースエージェントからの結果が取得できませんでした。フォールバック分析を実行します。"
            )
            analysis_result = {
                "risk_level": "SAFE",
                "confidence": 0.5,
                "sentiment": "neutral",
                "emotion": "neutral",
                "detected_issues": [],
                "suggestions": [
                    "プロンプトベース分析結果を取得できませんでした"
                ],
                "summary": "フォールバック分析",
                "processing_time_ms": 100,
                "status": "fallback",
                "detailed_analysis": {"harassment": {}, "confidential": {}},
            }

        logger.info(
            f"プロンプトベース・マルチエージェント分析完了: {analysis_result.get('risk_level', 'UNKNOWN')}"
        )

        return MessageResponse(**analysis_result)

    except Exception as e:
        logger.error(f"分析エラー: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"分析処理中にエラーが発生しました: {str(e)}",
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app", host="0.0.0.0", port=8080, reload=True, log_level="info"
    )
