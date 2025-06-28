"""
Simple LLM Service using Google Cloud ADK
シンプルなADK実装
"""

import asyncio
import json
import re
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from dotenv import load_dotenv
import os

load_dotenv()


# Google Cloud ADK imports
try:
    import vertexai
    from google.adk import Agent
    from google.adk.runners import InMemoryRunner
    from google.adk.tools.tool_context import ToolContext
    from google.genai import types

    vertexai.init(
        project=os.getenv("GOOGLE_CLOUD_PROJECT"),
        location=os.getenv("GOOGLE_CLOUD_REGION", "us-central1"),
    )

    ADK_AVAILABLE = True
except ImportError:
    ADK_AVAILABLE = False
    logging.warning("Google Cloud ADK not available")

logger = logging.getLogger(__name__)


@dataclass
class PolicyViolation:
    """ポリシー違反の結果"""

    is_violation: bool
    violation_type: str = ""
    severity: str = ""
    explanation: str = ""


@dataclass
class ChatAnalysisResult:
    """チャット解析の結果"""

    sentiment: str
    toxicity_score: float
    key_topics: List[str]
    summary: str


class SimpleLLMService:
    """シンプルなLLMサービス - ADK基盤"""

    def __init__(self):
        self.runner = None
        self.is_initialized = False
        self.app_name = "safecomm-ai"

    async def initialize(self):
        """初期化"""
        if not ADK_AVAILABLE:
            logger.warning("ADK not available, LLM calls will fail")
            return

        try:
            # ポリシーチェック用のエージェント
            self.policy_agent = Agent(
                model="gemini-2.0-flash",
                name="policy_checker",
                description="Workplace communication policy compliance checker",
                instruction="""
                You are a workplace japanese communication policy compliance checker.
                Analyze messages for policy violations including:
                - Harassment or discriminatory language (ハラスメント)
                - Inappropriate content (不適切なコンテンツ)
                - Confidential information leaks (機密情報漏洩)
                - Unprofessional behavior (非専門的な行動)
                
                You MUST respond ONLY with valid JSON in the following exact format:
                {
                    "is_violation": boolean,
                    "violation_type": "harassment" | "inappropriate" | "confidential" | "unprofessional" | "none",
                    "severity": "low" | "medium" | "high" | "none",
                    "explanation": "日本語での詳細な説明",
                    "suggestions": [
                        "改善提案1",
                        "改善提案2"
                    ],
                    "keywords_detected": ["検出されたキーワード"],
                    "confidence_score": 0.0-1.0
                }
                
                Do NOT include any text outside the JSON. The response must be valid JSON only.
                """,
                tools=[],
            )

            # チャット解析用のエージェント
            self.analysis_agent = Agent(
                model="gemini-2.0-flash",
                name="chat_analyzer",
                description="Chat message analyzer for sentiment and content",
                instruction="""
                You are a japanese chat message analyzer.
                Analyze messages for sentiment, toxicity, and content.
                
                You MUST respond ONLY with valid JSON in the following exact format:
                {
                    "sentiment": "positive" | "negative" | "neutral",
                    "sentiment_score": 0.0-1.0,
                    "toxicity_score": 0.0-1.0,
                    "emotion": "joy" | "anger" | "sadness" | "fear" | "surprise" | "disgust" | "neutral",
                    "key_topics": ["トピック1", "トピック2"],
                    "summary": "日本語での簡潔な要約",
                    "communication_style": "formal" | "informal" | "aggressive" | "friendly" | "neutral",
                    "risk_indicators": [
                        {
                            "type": "リスクタイプ",
                            "description": "説明",
                            "severity": "low" | "medium" | "high"
                        }
                    ],
                    "confidence_score": 0.0-1.0
                }
                
                Do NOT include any text outside the JSON. The response must be valid JSON only.
                """,
                tools=[],
            )

            # ランナーを作成
            self.policy_runner = InMemoryRunner(
                agent=self.policy_agent,
                app_name=self.app_name,
            )

            self.analysis_runner = InMemoryRunner(
                agent=self.analysis_agent,
                app_name=self.app_name,
            )

            self.is_initialized = True
            logger.info("Simple LLM Service initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize LLM Service: {e}")

    def _check_policy_compliance(
        self, message: str, tool_context: ToolContext
    ) -> Dict[str, Any]:
        """ポリシー準拠チェック（ツール関数）"""
        # この関数はエージェントが呼び出すツール
        # 実際の分析ロジックはエージェントのinstructionで処理される
        return {
            "message_analyzed": message,
            "timestamp": tool_context.state.get("timestamp", ""),
        }

    def _analyze_chat_message(
        self, message: str, tool_context: ToolContext
    ) -> Dict[str, Any]:
        """チャット解析（ツール関数）"""
        # この関数はエージェントが呼び出すツール
        # 実際の分析ロジックはエージェントのinstructionで処理される
        return {
            "message_analyzed": message,
            "timestamp": tool_context.state.get("timestamp", ""),
        }

    def _parse_json_response(self, response_text: str) -> Dict[str, Any]:
        """AgentからのJSONレスポンスをパース"""
        try:
            # JSONブロックを抽出（```json\s*(\{.*?\})\s*``` で囲まれている場合）
            json_match = re.search(
                r"```json\s*(\{.*?\})\s*```", response_text, re.DOTALL
            )
            if json_match:
                json_str = json_match.group(1)
            else:
                # 直接JSONが返される場合
                json_str = response_text.strip()

            # JSONパース
            parsed = json.loads(json_str)
            return parsed

        except (json.JSONDecodeError, AttributeError) as e:
            logger.warning(f"Failed to parse JSON response: {e}")
            logger.warning(f"Raw response: {response_text}")

            # フォールバック: 部分的にパースを試行
            return self._fallback_parse(response_text)

    def _fallback_parse(self, response_text: str) -> Dict[str, Any]:
        """JSONパースに失敗した場合のフォールバック"""
        # 基本的な情報を抽出しようと試行
        fallback_result = {}

        # violation関連の判定
        if any(
            word in response_text.lower()
            for word in ["violation", "違反", "inappropriate", "不適切"]
        ):
            fallback_result["is_violation"] = True
            fallback_result["violation_type"] = "unknown"
            fallback_result["severity"] = "medium"
        else:
            fallback_result["is_violation"] = False
            fallback_result["violation_type"] = "none"
            fallback_result["severity"] = "none"

        fallback_result["explanation"] = (
            response_text[:200] + "..."
            if len(response_text) > 200
            else response_text
        )
        fallback_result["suggestions"] = [
            "詳細な分析のため、再試行してください"
        ]
        fallback_result["confidence_score"] = 0.3

        return fallback_result

    async def check_policy_compliance(
        self, message: str, policies: List[str] = None
    ) -> PolicyViolation:
        """ポリシー準拠チェック"""
        if not self.is_initialized:
            await self.initialize()

        if not ADK_AVAILABLE or not self.is_initialized:
            # フォールバック
            return PolicyViolation(
                is_violation=False,
                explanation="ADK not available, skipping policy check",
            )

        try:
            # セッション作成
            session = await self.policy_runner.session_service.create_session(
                app_name=self.app_name, user_id="policy_checker"
            )

            # プロンプト作成
            prompt = f"Please analyze this message for policy compliance: {message}"
            if policies:
                prompt += (
                    f"\nPolicies to check against: {', '.join(policies)}"
                )

            content = types.Content(
                role="user", parts=[types.Part.from_text(text=prompt)]
            )

            # エージェント実行
            response_text = ""
            async for event in self.policy_runner.run_async(
                user_id="policy_checker",
                session_id=session.id,
                new_message=content,
            ):
                if hasattr(event, "content") and event.content:
                    for part in event.content.parts:
                        if hasattr(part, "text"):
                            response_text += part.text

            # レスポンス解析（JSON形式）
            parsed_response = self._parse_json_response(response_text)

            return PolicyViolation(
                is_violation=parsed_response.get("is_violation", False),
                violation_type=parsed_response.get("violation_type", ""),
                severity=parsed_response.get("severity", ""),
                explanation=parsed_response.get(
                    "explanation", response_text.strip()
                ),
            )

        except Exception as e:
            logger.error(f"Policy compliance check failed: {e}")
            return PolicyViolation(
                is_violation=False,
                explanation=f"Error during policy check: {str(e)}",
            )

    async def analyze_chat_message(
        self, message: str, context: Dict[str, Any] = None
    ) -> ChatAnalysisResult:
        """チャットメッセージ解析"""
        if not self.is_initialized:
            await self.initialize()

        if not ADK_AVAILABLE or not self.is_initialized:
            # フォールバック
            return ChatAnalysisResult(
                sentiment="neutral",
                toxicity_score=0.0,
                key_topics=[],
                summary="ADK not available, analysis skipped",
            )

        try:
            # セッション作成
            session = (
                await self.analysis_runner.session_service.create_session(
                    app_name=self.app_name, user_id="chat_analyzer"
                )
            )

            # プロンプト作成
            prompt = f"Please analyze this chat message: {message}"
            if context:
                prompt += f"\nContext: {context}"

            content = types.Content(
                role="user", parts=[types.Part.from_text(text=prompt)]
            )

            # エージェント実行
            response_text = ""
            async for event in self.analysis_runner.run_async(
                user_id="chat_analyzer",
                session_id=session.id,
                new_message=content,
            ):
                if hasattr(event, "content") and event.content:
                    for part in event.content.parts:
                        if hasattr(part, "text"):
                            response_text += part.text

            # レスポンス解析（JSON形式）
            parsed_response = self._parse_json_response(response_text)

            return ChatAnalysisResult(
                sentiment=parsed_response.get("sentiment", "neutral"),
                toxicity_score=parsed_response.get("toxicity_score", 0.0),
                key_topics=parsed_response.get("key_topics", ["general"]),
                summary=parsed_response.get("summary", response_text.strip()),
            )

        except Exception as e:
            logger.error(f"Chat analysis failed: {e}")
            return ChatAnalysisResult(
                sentiment="neutral",
                toxicity_score=0.0,
                key_topics=[],
                summary=f"Error during analysis: {str(e)}",
            )

    async def get_detailed_policy_analysis(
        self, message: str, policies: List[str] = None
    ) -> Dict[str, Any]:
        """詳細なポリシー分析を取得（JSON形式）"""
        if not self.is_initialized:
            await self.initialize()

        if not ADK_AVAILABLE or not self.is_initialized:
            return {
                "suggestions": ["ADK not available"],
                "keywords_detected": [],
                "confidence_score": 0.0,
            }

        try:
            # セッション作成
            session = await self.policy_runner.session_service.create_session(
                app_name=self.app_name, user_id="policy_checker"
            )

            # プロンプト作成
            prompt = f"Please analyze this message for policy compliance: {message}"
            if policies:
                prompt += (
                    f"\nPolicies to check against: {', '.join(policies)}"
                )

            content = types.Content(
                role="user", parts=[types.Part.from_text(text=prompt)]
            )

            # エージェント実行
            response_text = ""
            async for event in self.policy_runner.run_async(
                user_id="policy_checker",
                session_id=session.id,
                new_message=content,
            ):
                if hasattr(event, "content") and event.content:
                    for part in event.content.parts:
                        if hasattr(part, "text"):
                            response_text += part.text

            # JSONレスポンスをパース
            return self._parse_json_response(response_text)

        except Exception as e:
            logger.error(f"Detailed policy analysis failed: {e}")
            return {
                "suggestions": [f"分析エラー: {str(e)}"],
                "keywords_detected": [],
                "confidence_score": 0.0,
            }

    async def get_detailed_chat_analysis(
        self, message: str, context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """詳細なチャット分析を取得（JSON形式）"""
        if not self.is_initialized:
            await self.initialize()

        if not ADK_AVAILABLE or not self.is_initialized:
            return {
                "emotion": "neutral",
                "communication_style": "neutral",
                "risk_indicators": [],
                "confidence_score": 0.0,
            }

        try:
            # セッション作成
            session = (
                await self.analysis_runner.session_service.create_session(
                    app_name=self.app_name, user_id="chat_analyzer"
                )
            )

            # プロンプト作成
            prompt = f"Please analyze this chat message: {message}"
            if context:
                prompt += f"\nContext: {context}"

            content = types.Content(
                role="user", parts=[types.Part.from_text(text=prompt)]
            )

            # エージェント実行
            response_text = ""
            async for event in self.analysis_runner.run_async(
                user_id="chat_analyzer",
                session_id=session.id,
                new_message=content,
            ):
                if hasattr(event, "content") and event.content:
                    for part in event.content.parts:
                        if hasattr(part, "text"):
                            response_text += part.text

            # JSONレスポンスをパース
            return self._parse_json_response(response_text)

        except Exception as e:
            logger.error(f"Detailed chat analysis failed: {e}")
            return {
                "emotion": "neutral",
                "communication_style": "neutral",
                "risk_indicators": [],
                "confidence_score": 0.0,
            }


# グローバルインスタンス
_llm_service = None


async def get_llm_service() -> SimpleLLMService:
    """LLMサービスのシングルトンインスタンスを取得"""
    global _llm_service
    if _llm_service is None:
        _llm_service = SimpleLLMService()
        await _llm_service.initialize()
    return _llm_service
