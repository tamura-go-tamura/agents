"""
Simple Chat Analysis Agent
シンプルなチャット解析エージェント
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from src.utils.llm_service_simple import get_llm_service, ChatAnalysisResult

logger = logging.getLogger(__name__)


class SimpleChatAnalysisAgent:
    """シンプルなチャット解析エージェント"""

    def __init__(self):
        self.analysis_history = []

    async def analyze_message(
        self, message: str, context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """メッセージを解析"""
        try:
            logger.info(f"Analyzing message: {message[:50]}...")

            # LLMサービスを使用してメッセージ解析
            llm_service = await get_llm_service()
            result = await llm_service.analyze_chat_message(message, context)

            # 詳細な構造化レスポンスを取得
            detailed_result = await llm_service.get_detailed_chat_analysis(
                message, context
            )

            analysis = {
                "message": message,
                "sentiment": result.sentiment,
                "sentiment_score": detailed_result.get(
                    "sentiment_score", 0.5
                ),
                "toxicity_score": result.toxicity_score,
                "emotion": detailed_result.get("emotion", "neutral"),
                "communication_style": detailed_result.get(
                    "communication_style", "neutral"
                ),
                "key_topics": result.key_topics,
                "summary": result.summary,
                "risk_indicators": detailed_result.get("risk_indicators", []),
                "confidence_score": detailed_result.get(
                    "confidence_score", 0.5
                ),
                "timestamp": datetime.now().isoformat(),
            }

            # 履歴に追加
            self.analysis_history.append(analysis)

            return analysis

        except Exception as e:
            logger.error(f"Message analysis failed: {e}")
            return {
                "message": message,
                "sentiment": "neutral",
                "toxicity_score": 0.0,
                "key_topics": [],
                "summary": f"Analysis failed: {str(e)}",
                "timestamp": datetime.now().isoformat(),
            }

    async def get_conversation_insights(
        self, messages: List[str]
    ) -> Dict[str, Any]:
        """会話全体の洞察を取得"""
        try:
            # 各メッセージを解析
            analyses = []
            for message in messages:
                analysis = await self.analyze_message(message)
                analyses.append(analysis)

            # 全体的な傾向を計算
            sentiments = [a["sentiment"] for a in analyses]
            avg_toxicity = (
                sum(a["toxicity_score"] for a in analyses) / len(analyses)
                if analyses
                else 0.0
            )

            return {
                "total_messages": len(messages),
                "overall_sentiment": (
                    max(set(sentiments), key=sentiments.count)
                    if sentiments
                    else "neutral"
                ),
                "average_toxicity": avg_toxicity,
                "analyses": analyses,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            logger.error(f"Conversation insights failed: {e}")
            return {
                "total_messages": len(messages),
                "overall_sentiment": "neutral",
                "average_toxicity": 0.0,
                "analyses": [],
                "error": str(e),
                "timestamp": datetime.now().isoformat(),
            }

    def get_analysis_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """解析履歴を取得"""
        return self.analysis_history[-limit:]
