"""
Simple Coordinator for SafeComm AI
シンプルなコーディネーター
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from src.agents.policy_manager_agent_simple import SimplePolicyManagerAgent
from src.agents.chat_analysis_agent_simple import SimpleChatAnalysisAgent
from src.models.message import RiskLevel

logger = logging.getLogger(__name__)


class SimpleCoordinator:
    """シンプルなエージェントコーディネーター"""

    def __init__(self):
        self.policy_agent = SimplePolicyManagerAgent()
        self.analysis_agent = SimpleChatAnalysisAgent()
        self.is_initialized = False

    async def initialize(self):
        """初期化"""
        try:
            logger.info("Initializing Simple Coordinator...")
            # エージェントは既に初期化済みなので特別な処理は不要
            self.is_initialized = True
            logger.info("Simple Coordinator initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize coordinator: {e}")

    async def process_message(
        self, message: str, context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """メッセージを処理（ポリシーチェック + 解析）"""
        if not self.is_initialized:
            await self.initialize()

        try:
            logger.info(f"Processing message: {message[:50]}...")

            # 並行してポリシーチェックと解析を実行
            policy_task = self.policy_agent.check_message_compliance(
                message, context
            )
            analysis_task = self.analysis_agent.analyze_message(
                message, context
            )

            policy_result, analysis_result = await asyncio.gather(
                policy_task, analysis_task, return_exceptions=True
            )

            # エラーハンドリング
            if isinstance(policy_result, Exception):
                logger.error(f"Policy check failed: {policy_result}")
                policy_result = {
                    "compliant": True,
                    "error": str(policy_result),
                }

            if isinstance(analysis_result, Exception):
                logger.error(f"Analysis failed: {analysis_result}")
                analysis_result = {
                    "sentiment": "neutral",
                    "error": str(analysis_result),
                }

            return {
                "message": message,
                "policy_compliance": policy_result,
                "analysis": analysis_result,
                "timestamp": datetime.now().isoformat(),
                "status": "processed",
            }

        except Exception as e:
            logger.error(f"Message processing failed: {e}")
            return {
                "message": message,
                "error": str(e),
                "timestamp": datetime.now().isoformat(),
                "status": "error",
            }

    async def get_conversation_summary(
        self, messages: List[str]
    ) -> Dict[str, Any]:
        """会話の要約を取得"""
        try:
            # 会話全体の洞察を取得
            insights = await self.analysis_agent.get_conversation_insights(
                messages
            )

            # 各メッセージのポリシーチェック結果も取得
            policy_checks = []
            for message in messages:
                policy_result = (
                    await self.policy_agent.check_message_compliance(message)
                )
                policy_checks.append(policy_result)

            # 違反の集計
            violations = [
                check
                for check in policy_checks
                if check.get("violation_detected", False)
            ]

            return {
                "conversation_insights": insights,
                "policy_summary": {
                    "total_messages": len(messages),
                    "violations_detected": len(violations),
                    "compliance_rate": (
                        (len(messages) - len(violations)) / len(messages)
                        if messages
                        else 1.0
                    ),
                },
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            logger.error(f"Conversation summary failed: {e}")
            return {"error": str(e), "timestamp": datetime.now().isoformat()}

    async def route_request(
        self, request_type: str, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """既存APIとの互換性のためのルーティングメソッド"""
        try:
            if request_type == "chat_analysis":
                # MessageAnalysisRequestの形式からメッセージを抽出
                message = data.get("message", data.get("content", ""))
                user_id = data.get("user_id", "unknown")

                # メッセージ処理
                result = await self.process_message(
                    message, {"user_id": user_id}
                )

                # 違反検出
                is_violation = not result["policy_compliance"].get(
                    "compliant", True
                )
                toxicity_score = result["analysis"].get("toxicity_score", 0.0)

                # リスクレベル決定
                if is_violation or toxicity_score > 0.7:
                    risk_level = "danger"
                elif toxicity_score > 0.3:
                    risk_level = "warning"
                else:
                    risk_level = "safe"

                # 検出された問題
                detected_issues = []
                if is_violation:
                    detected_issues.append(
                        result["policy_compliance"].get(
                            "violation_type", "policy_violation"
                        )
                    )
                if toxicity_score > 0.5:
                    detected_issues.append("toxic_content")

                # 提案
                suggestions = []
                if is_violation:
                    suggestions.extend(
                        result["policy_compliance"].get("suggestions", [])
                    )
                if not suggestions:
                    suggestions = result["policy_compliance"].get(
                        "recommendations", []
                    )

                # MessageAnalysisResponseの形式に変換（構造化レスポンス活用）
                return {
                    "risk_level": risk_level,
                    "confidence": result["policy_compliance"].get(
                        "confidence_score", 0.8
                    ),
                    "detected_issues": detected_issues,
                    "suggestions": suggestions,
                    "flagged_content": result["policy_compliance"].get(
                        "keywords_detected", []
                    ),
                    "compliance_notes": result["policy_compliance"].get(
                        "explanation", ""
                    ),
                    "processing_time_ms": 100,  # 固定値
                    "detailed_analysis": {
                        "sentiment": result["analysis"].get(
                            "sentiment", "neutral"
                        ),
                        "emotion": result["analysis"].get(
                            "emotion", "neutral"
                        ),
                        "communication_style": result["analysis"].get(
                            "communication_style", "neutral"
                        ),
                        "risk_indicators": result["analysis"].get(
                            "risk_indicators", []
                        ),
                        "policy_details": {
                            "violation_type": result["policy_compliance"].get(
                                "violation_type", "none"
                            ),
                            "severity": result["policy_compliance"].get(
                                "severity", "none"
                            ),
                            "keywords_detected": result[
                                "policy_compliance"
                            ].get("keywords_detected", []),
                        },
                    },
                }

            elif request_type == "policy_check":
                # ポリシーチェック専用リクエスト
                message = data.get("message", data.get("content", ""))
                policies = data.get("policies", [])

                # ポリシーチェック実行
                policy_result = (
                    await self.policy_agent.check_message_compliance(
                        message, {"policies": policies}
                    )
                )

                is_violation = not policy_result.get("compliant", True)

                return {
                    "compliant": policy_result.get("compliant", True),
                    "violation_detected": is_violation,
                    "violation_type": policy_result.get("violation_type", ""),
                    "severity": policy_result.get("severity", ""),
                    "explanation": policy_result.get("explanation", ""),
                    "suggestions": policy_result.get("suggestions", []),
                    "keywords_detected": policy_result.get(
                        "keywords_detected", []
                    ),
                    "confidence_score": policy_result.get(
                        "confidence_score", 0.5
                    ),
                    "policies_checked": policy_result.get(
                        "policies_checked", policies
                    ),
                    "timestamp": policy_result.get(
                        "timestamp", datetime.now().isoformat()
                    ),
                }
            else:
                logger.warning(f"Unknown request type: {request_type}")
                return {
                    "risk_level": "safe",
                    "confidence": 0.0,
                    "detected_issues": [
                        f"Unknown request type: {request_type}"
                    ],
                    "suggestions": [],
                    "flagged_content": [],
                    "compliance_notes": f"Error: Unknown request type {request_type}",
                    "processing_time_ms": 0,
                }

        except Exception as e:
            logger.error(f"Route request failed: {e}")
            return {
                "risk_level": "safe",
                "confidence": 0.0,
                "detected_issues": ["processing_error"],
                "suggestions": [],
                "flagged_content": [],
                "compliance_notes": f"Error: {str(e)}",
                "processing_time_ms": 0,
            }
