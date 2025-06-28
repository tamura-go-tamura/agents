"""
Simple Policy Manager Agent
シンプルなポリシー管理エージェント
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from src.utils.llm_service_simple import get_llm_service, PolicyViolation

logger = logging.getLogger(__name__)


class SimplePolicyManagerAgent:
    """シンプルなポリシー管理エージェント"""

    def __init__(self):
        self.policies = [
            "No harassment or discriminatory language",
            "Keep communication professional",
            "Protect confidential information",
            "Be respectful to all team members",
        ]

    async def check_message_compliance(
        self, message: str, context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """メッセージのポリシー準拠をチェック"""
        try:
            logger.info(
                f"Checking policy compliance for message: {message[:50]}..."
            )

            # LLMサービスを使用してポリシーチェック
            llm_service = await get_llm_service()
            result = await llm_service.check_policy_compliance(
                message, self.policies
            )

            # 構造化されたレスポンスを取得（LLMServiceが内部でJSONパースしている）
            # さらに詳細情報が必要な場合は、LLMServiceから直接JSONデータを取得
            detailed_result = await llm_service.get_detailed_policy_analysis(
                message, self.policies
            )

            return {
                "compliant": not result.is_violation,
                "violation_detected": result.is_violation,
                "violation_type": result.violation_type,
                "severity": result.severity,
                "explanation": result.explanation,
                "suggestions": detailed_result.get("suggestions", []),
                "keywords_detected": detailed_result.get(
                    "keywords_detected", []
                ),
                "confidence_score": detailed_result.get(
                    "confidence_score", 0.5
                ),
                "policies_checked": self.policies,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            logger.error(f"Policy compliance check failed: {e}")
            return {
                "compliant": True,  # デフォルトで通す
                "violation_detected": False,
                "explanation": f"Policy check failed: {str(e)}",
                "timestamp": datetime.now().isoformat(),
            }

    async def get_policy_recommendations(
        self, message: str
    ) -> Dict[str, Any]:
        """ポリシー改善の推奨事項を取得"""
        try:
            compliance_result = await self.check_message_compliance(message)

            if compliance_result["compliant"]:
                return {
                    "recommendations": [
                        "Message appears compliant with policies"
                    ],
                    "severity": "none",
                }
            else:
                return {
                    "recommendations": [
                        "Review message content for policy compliance",
                        "Consider rephrasing to be more professional",
                        "Ensure no confidential information is shared",
                    ],
                    "severity": compliance_result.get("severity", "medium"),
                }

        except Exception as e:
            logger.error(f"Failed to get policy recommendations: {e}")
            return {
                "recommendations": [
                    "Unable to provide recommendations due to error"
                ],
                "severity": "unknown",
            }
