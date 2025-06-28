"""
Agent Coordinator - メインコーディネーター
全Agentの統括・ルーティング・セッション管理
"""

import asyncio
import logging
from typing import Dict, Any, Optional
import time

# ADK imports (今後実装)
# from google.adk.agents import LlmAgent
# from google.adk.runners import Runner
# from google.adk.sessions import InMemorySessionService

from src.config.settings import Settings
from src.agents.chat_analysis_agent import ChatAnalysisAgent
from src.agents.policy_manager_agent import PolicyManagerAgent
from src.models.message import RiskLevel

logger = logging.getLogger(__name__)


class AgentCoordinator:
    """メインコーディネーター - 全Agentの統括"""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.agents = {}
        self.session_service = None  # ADK Session Service
        self.is_initialized = False

    async def initialize(self):
        """Coordinator初期化"""
        try:
            logger.info("Initializing Agent Coordinator...")

            # ADK Session Service初期化
            # self.session_service = InMemorySessionService()

            # 各Agent初期化
            self.agents = {
                "chat_analysis": ChatAnalysisAgent(self.settings),
                "policy_manager": PolicyManagerAgent(self.settings),
                # 'voice_analysis': VoiceAnalysisAgent(self.settings),  # Phase 2
                # 'notification': NotificationAgent(self.settings),     # Phase 2
                # 'report_generator': ReportGeneratorAgent(self.settings),  # Phase 3
                # 'analytics': AnalyticsAgent(self.settings)            # Phase 3
            }

            # 各Agent初期化
            for agent_name, agent in self.agents.items():
                await agent.initialize()
                logger.info(f"Initialized {agent_name} agent")

            self.is_initialized = True
            logger.info("Agent Coordinator initialized successfully!")

        except Exception as e:
            logger.error(f"Failed to initialize Agent Coordinator: {e}")
            raise

    async def health_check(self) -> str:
        """ヘルスチェック"""
        if not self.is_initialized:
            return "not_initialized"

        try:
            # 各Agentのヘルスチェック
            for agent_name, agent in self.agents.items():
                if hasattr(agent, "health_check"):
                    status = await agent.health_check()
                    if status != "healthy":
                        return f"{agent_name}_unhealthy"

            return "healthy"

        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return "error"

    async def route_request(
        self, request_type: str, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """リクエストを適切なAgentにルーティング"""

        if not self.is_initialized:
            raise Exception("Agent Coordinator not initialized")

        start_time = time.time()

        try:
            if request_type == "chat_analysis":
                return await self._handle_chat_analysis(data)
            elif request_type == "voice_analysis":
                return await self._handle_voice_analysis(data)
            elif request_type == "generate_report":
                return await self._handle_report_generation(data)
            else:
                raise ValueError(f"Unknown request type: {request_type}")

        except Exception as e:
            logger.error(f"Request routing failed: {e}")
            # フォールバック処理
            return self._create_fallback_response(str(e), start_time)

    async def _handle_chat_analysis(
        self, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """チャット分析フロー"""
        start_time = time.time()

        try:
            # 並列でチャット分析とポリシーチェックを実行
            tasks = [
                self.agents["chat_analysis"].analyze(data),
                self.agents["policy_manager"].check_compliance(data),
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # 結果統合
            chat_result = (
                results[0] if not isinstance(results[0], Exception) else None
            )
            policy_result = (
                results[1] if not isinstance(results[1], Exception) else None
            )

            # 最終判定
            final_result = self._merge_analysis_results(
                chat_result, policy_result
            )

            # 処理時間追加
            processing_time = int((time.time() - start_time) * 1000)
            final_result["processing_time_ms"] = processing_time

            # 危険レベルの場合の通知（Phase 2で実装）
            if final_result.get("risk_level") == RiskLevel.DANGER:
                # await self.agents['notification'].send_alert(final_result)
                logger.warning(
                    f"High risk message detected: {data.get('message', '')[:50]}..."
                )

            return final_result

        except Exception as e:
            logger.error(f"Chat analysis failed: {e}")
            return self._create_fallback_response(str(e), start_time)

    async def _handle_voice_analysis(
        self, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """音声分析フロー（Phase 2で実装）"""
        # TODO: Phase 2で実装
        return {
            "risk_level": RiskLevel.SAFE,
            "message": "Voice analysis not implemented yet",
            "processing_time_ms": 100,
        }

    async def _handle_report_generation(
        self, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """レポート生成フロー（Phase 3で実装）"""
        # TODO: Phase 3で実装
        return {
            "report_type": "mock",
            "message": "Report generation not implemented yet",
            "processing_time_ms": 200,
        }

    def _merge_analysis_results(
        self, chat_result: Optional[Dict], policy_result: Optional[Dict]
    ) -> Dict[str, Any]:
        """分析結果をマージ"""

        # デフォルト結果
        merged = {
            "risk_level": RiskLevel.SAFE,
            "confidence": 0.8,
            "detected_issues": [],
            "suggestions": [],
            "flagged_content": [],
            "compliance_notes": "",
        }

        if chat_result:
            merged.update(chat_result)

        if policy_result:
            # ポリシー結果を統合
            if policy_result.get("violations"):
                merged["risk_level"] = RiskLevel.DANGER
                merged["detected_issues"].extend(
                    [v["policy_name"] for v in policy_result["violations"]]
                )
                merged["compliance_notes"] = "Policy violations detected"

        return merged

    def _create_fallback_response(
        self, error_message: str, start_time: float
    ) -> Dict[str, Any]:
        """フォールバック レスポンス生成"""
        processing_time = int((time.time() - start_time) * 1000)

        return {
            "risk_level": RiskLevel.WARNING,
            "confidence": 0.5,
            "detected_issues": ["system_error"],
            "suggestions": [
                "システムエラーが発生しました。メッセージを再確認してください。"
            ],
            "flagged_content": [],
            "compliance_notes": f"System error: {error_message}",
            "processing_time_ms": processing_time,
        }
