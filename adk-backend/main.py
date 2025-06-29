"""
ADKを使用したシンプルなメッセージ分析API
"""

import asyncio
import json
import logging
import os
import base64
import time
import numpy as np
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List
from dotenv import load_dotenv
from websockets.exceptions import ConnectionClosedOK

from google.adk.runners import InMemoryRunner
from google.adk.sessions import Session
from google.genai import types
from google import genai
from google.genai import types

# ADKオーケストラエージェントをインポート
from agents.message_analyzer_orchestrator import message_analyzer_orchestrator

# チャット分析レポート用エージェントをインポート
from agents.chat_analysis_agent import chat_analysis_orchestrator

# 環境変数を読み込み
load_dotenv()

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

# Google GenAI クライアント設定（音声分析用）
genai_client = genai.Client(
    vertexai=True,
    project=os.getenv("GOOGLE_CLOUD_PROJECT"),
    location=os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1"),
)
MODEL_ID = "gemini-live-2.5-flash-preview-native-audio"

# ADK Runnerの初期化（テキスト分析用）
app_name = "safecomm_multiagent_app"
runner = InMemoryRunner(
    agent=message_analyzer_orchestrator,
    app_name=app_name,
)

# チャット分析用のランナー
chat_analysis_app_name = "safecomm_chat_analysis_app"
chat_analysis_runner = InMemoryRunner(
    agent=chat_analysis_orchestrator,
    app_name=chat_analysis_app_name,
)

# セッション管理
sessions: Dict[str, Session] = {}
active_websocket_sessions: Dict[str, Dict[str, Any]] = {}


class MessageRequest(BaseModel):
    """メッセージ分析リクエスト"""

    message: str
    user_id: str = "default_user"
    room_id: str = ""
    timestamp: str = ""


class MessageResponse(BaseModel):
    """現在のAnalysisResult形式に対応したメッセージ分析レスポンス"""

    risk_level: str
    confidence: float
    detected_issues: List[str]
    suggestions: List[str]
    flagged_content: List[str]
    processing_time_ms: float
    compliance_notes: str
    detailed_analysis: Dict[str, Any]


class ChatAnalysisRequest(BaseModel):
    """チャット分析レポートリクエスト"""

    messages: List[Dict[str, Any]]  # チャットメッセージのリスト
    chat_id: str = "default_chat"
    user_id: str = "default_user"


class ChatAnalysisResponse(BaseModel):
    """チャット分析レポートレスポンス"""

    summary: Dict[str, Any]
    compliance_report: Dict[str, Any]
    confidential_report: Dict[str, Any]
    timeline_analysis: Dict[str, Any]
    detailed_findings: List[Dict[str, Any]]
    processing_time_ms: float


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
                        final_response_text = part.text

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
                "detected_issues": [],
                "suggestions": [
                    "プロンプトベース分析結果を取得できませんでした"
                ],
                "flagged_content": [],
                "processing_time_ms": 100,
                "compliance_notes": "フォールバック分析",
                "detailed_analysis": {
                    "sentiment": "neutral",
                    "emotion": "neutral",
                    "communication_style": "unknown",
                    "risk_indicators": [],
                    "policy_details": {
                        "violation_type": "none",
                        "severity": "low",
                        "keywords_detected": [],
                    },
                },
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


# 古いWebSocketエンドポイントは削除済み - /ws/audio-analysis に統一


@app.websocket("/ws/audio-analysis")
async def websocket_audio_analysis(websocket: WebSocket):
    """
    統一されたリアルタイム音声分析WebSocketエンドポイント
    Vertex AI Live API を使用してリアルタイム音声分析と AI介入を実行
    """
    await websocket.accept()
    session_id = None
    genai_session = None
    response_task = None

    try:
        logger.info("新しいWebSocket音声分析セッションが開始されました")

        # Vertex AI Live API セッション設定（公式ドキュメント準拠）
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],  # 音声レスポンスを有効化
            system_instruction="""
あなたは、会社で上司と部下の1on1の様子をフレンドリーに監視する、ユーモア溢れる関西人です。
いざとゆう時にしか発言しません.
ユーザーの発言を聞いて、危険な発言を検出した場合は即座に雰囲気を和ませながら、指摘してください。
発言回数は最小限にとどめてください。

【介入条件】
- ハラスメント、脅迫、攻撃的な発言
- 差別的発言
- 機密情報の漏洩
- 不適切な言語表現

【介入時の対応】
危険な発言を検出した場合は、どんな言葉がだめだったかを挙げるなどして、
オリジナリティあふれる関西弁でお答えください。

特に問題がなければ、応答する必要はありません。
""",
        )

        # Vertex AI Live APIセッション開始
        async with genai_client.aio.live.connect(
            model=MODEL_ID, config=config
        ) as genai_session:

            # Live APIからのレスポンスを受信する並行タスクを開始
            async def handle_live_api_responses():
                cnt = 0
                while True:
                    try:
                        async for response in genai_session.receive():
                            if hasattr(response, "data") and response.data:
                                # 音声データをリアルタイムでストリーミング送信
                                audio_base64 = base64.b64encode(
                                    response.data
                                ).decode("utf-8")
                                await websocket.send_json(
                                    {
                                        "type": "ai_audio_stream",
                                        "audio_data": audio_base64,
                                        "chunk_size": len(response.data),
                                    }
                                )
                                logger.debug(
                                    f"音声チャンク送信: {len(response.data)} bytes"
                                )
                    except Exception as e:
                        cnt += 1
                        if cnt > 10:
                            break
                        logger.error(f"Live API レスポンス処理エラー: {e}")

            response_task = asyncio.create_task(handle_live_api_responses())

            # セッション開始メッセージ
            await websocket.send_json(
                {
                    "type": "session_started",
                    "message": "音声分析セッションが開始されました",
                }
            )

            # メッセージ処理のメインループ
            while True:
                try:
                    # クライアントからのメッセージを受信
                    message = await websocket.receive_json()
                    logger.debug(
                        f"受信メッセージタイプ: {message.get('type', 'unknown')}"
                    )

                    if message["type"] == "audio_chunk":
                        try:
                            # 音声データの存在確認
                            if "audio_data" not in message:
                                await websocket.send_json(
                                    {
                                        "type": "error",
                                        "message": "音声データが含まれていません",
                                    }
                                )
                                continue

                            # Base64デコード
                            audio_data = base64.b64decode(
                                message["audio_data"]
                            )

                            # Live APIに送信
                            blob = types.Blob(
                                data=audio_data,
                                mime_type="audio/pcm;rate=16000",
                            )

                            await genai_session.send_realtime_input(
                                media=blob
                            )

                            # 成功確認
                            await websocket.send_json(
                                {
                                    "type": "audio_received",
                                    "size": len(audio_data),
                                    "status": "sent_to_live_api",
                                }
                            )

                        except Exception as audio_error:
                            logger.error(f"音声処理エラー: {audio_error}")
                            await websocket.send_json(
                                {
                                    "type": "error",
                                    "message": f"音声処理エラー: {str(audio_error)}",
                                }
                            )

                    elif message["type"] == "start_session":
                        session_id = message.get("session_id", "default")
                        active_websocket_sessions[session_id] = {
                            "websocket": websocket,
                            "genai_session": genai_session,
                            "status": "active",
                        }

                    elif message["type"] == "stop_session":
                        break

                except Exception as e:
                    logger.error(f"メッセージ処理エラー: {e}")
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": f"エラーが発生しました: {str(e)}",
                        }
                    )

    except WebSocketDisconnect:
        logger.info("WebSocket接続が切断されました")
    except ConnectionClosedOK:
        logger.info("WebSocket接続が正常に終了しました")
    except Exception as e:
        logger.error(f"WebSocketエラー: {e}")
        try:
            await websocket.send_json(
                {"type": "error", "message": f"接続エラー: {str(e)}"}
            )
        except:
            pass
    finally:
        # クリーンアップ
        if response_task:
            response_task.cancel()
            try:
                await response_task
            except asyncio.CancelledError:
                pass
        if session_id and session_id in active_websocket_sessions:
            del active_websocket_sessions[session_id]
        if genai_session:
            try:
                await genai_session.close()
            except:
                pass


@app.post("/api/analyze-chat", response_model=ChatAnalysisResponse)
async def analyze_chat(request: ChatAnalysisRequest):
    """
    チャット全体を分析してコンプライアンス・機密情報漏洩レポートを生成
    """
    import time

    start_time = time.time()

    try:
        logger.info(
            f"チャット分析レポート生成開始: {len(request.messages)}件のメッセージ"
        )

        # チャット分析用のセッションを取得
        if request.user_id not in sessions:
            sessions[request.user_id] = (
                await chat_analysis_runner.session_service.create_session(
                    app_name=chat_analysis_app_name, user_id=request.user_id
                )
            )
        session = sessions[request.user_id]

        # チャットメッセージを整理してプロンプトを作成
        messages_text = ""
        for i, msg in enumerate(request.messages):
            timestamp = msg.get("timestamp", f"時刻{i+1}")
            user = msg.get("user", f"ユーザー{i+1}")
            content = msg.get("content", msg.get("message", ""))
            messages_text += f"[{timestamp}] {user}: {content}\n"

        analysis_prompt = f"""
以下のチャット履歴を包括的に分析してください。
時系列でのリスク推移、コンプライアンス違反、機密情報漏洩リスクを詳細に評価してください。

【チャット履歴】
{messages_text}

【分析対象】
- 参加者: {len(set(msg.get('user', 'unknown') for msg in request.messages))}名
- メッセージ数: {len(request.messages)}件
- チャットID: {request.chat_id}

包括的なリスク分析と改善提案を含むレポートを生成してください。
"""

        # チャット分析エージェントに分析を依頼
        content = types.Content(
            role="user", parts=[types.Part.from_text(text=analysis_prompt)]
        )

        # チャット分析エージェントを実行
        analysis_result = None
        final_response_text = ""

        async for event in chat_analysis_runner.run_async(
            user_id=request.user_id,
            session_id=session.id,
            new_message=content,
        ):
            # エージェントからのテキストレスポンスを取得
            if hasattr(event, "content") and event.content:
                for part in event.content.parts:
                    if hasattr(part, "text") and part.text:
                        final_response_text = part.text

        # エージェントのJSONレスポンスを解析
        if final_response_text:
            try:
                # JSONの開始と終了を見つけて抽出
                json_start = final_response_text.find("{")
                json_end = final_response_text.rfind("}") + 1

                if json_start != -1 and json_end > json_start:
                    json_text = final_response_text[json_start:json_end]
                    analysis_result = json.loads(json_text)
                    logger.info("チャット分析レポート生成完了")
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
                "チャット分析結果が取得できませんでした。フォールバック分析を実行します。"
            )
            analysis_result = {
                "summary": {
                    "overall_risk_level": "SAFE",
                    "total_messages": len(request.messages),
                    "analysis_timestamp": datetime.now().isoformat(),
                    "chat_duration_minutes": 30,
                    "participants": list(
                        set(
                            msg.get("user", "unknown")
                            for msg in request.messages
                        )
                    ),
                },
                "compliance_report": {
                    "total_violations": 0,
                    "violation_rate": 0.0,
                    "legal_risk_level": "low",
                    "violations": [],
                    "recommended_actions": [
                        "分析エージェントからの結果を取得できませんでした"
                    ],
                },
                "confidential_report": {
                    "total_leaks": 0,
                    "security_risk_level": "low",
                    "leak_types": [],
                    "mitigation_steps": [],
                },
                "timeline_analysis": {
                    "risk_trend": "stable",
                    "risk_timeline": [],
                    "participant_stats": [],
                },
                "detailed_findings": [],
            }

        processing_time = (time.time() - start_time) * 1000

        response = ChatAnalysisResponse(
            summary=analysis_result.get("summary", {}),
            compliance_report=analysis_result.get("compliance_report", {}),
            confidential_report=analysis_result.get(
                "confidential_report", {}
            ),
            timeline_analysis=analysis_result.get("timeline_analysis", {}),
            detailed_findings=analysis_result.get("detailed_findings", []),
            processing_time_ms=processing_time,
        )
        response.summary["analysis_timestamp"] = datetime.now().isoformat()

        logger.info(f"チャット分析完了: 処理時間 {processing_time:.1f}ms")
        return response

    except Exception as e:
        logger.error(f"チャット分析エラー: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"チャット分析処理中にエラーが発生しました: {str(e)}",
        )


if __name__ == "__main__":
    import uvicorn

    logger.info("SafeComm統合APIサーバーを起動しています...")
    logger.info("- テキスト分析: POST /api/analyze-message")
    logger.info("- リアルタイム音声分析: WebSocket /ws/audio-analysis")
    logger.info("- チャット分析: POST /api/analyze-chat")
    logger.info("- ヘルスチェック: GET /health")

    uvicorn.run(
        "main:app", host="0.0.0.0", port=8080, reload=True, log_level="info"
    )
