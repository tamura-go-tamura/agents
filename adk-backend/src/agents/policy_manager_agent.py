"""
Policy Manager Agent - ポリシー管理エージェント
企業コンプライアンスポリシーの管理と適用
"""

import asyncio
import logging
import re
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import json

# Firestore imports (今後実装)
# from google.cloud import firestore

from src.config.settings import Settings
from src.models.message import RiskLevel

logger = logging.getLogger(__name__)


class PolicyManagerAgent:
    """ポリシー管理Agent - Firestoreベース"""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.firestore_client = None
        self.policies = {}
        self.policy_cache = {}
        self.cache_expiry = timedelta(hours=1)
        self.is_initialized = False

    async def initialize(self):
        """Agent初期化"""
        try:
            logger.info("Initializing Policy Manager Agent...")

            # Firestore初期化（今後実装）
            # self.firestore_client = firestore.Client(project=self.settings.google_cloud_project)

            # デモ用ポリシー読み込み
            await self._load_demo_policies()

            self.is_initialized = True
            logger.info("Policy Manager Agent initialized successfully!")

        except Exception as e:
            logger.error(f"Failed to initialize Policy Manager Agent: {e}")
            raise

    async def health_check(self) -> str:
        """ヘルスチェック"""
        if not self.is_initialized:
            return "not_initialized"

        try:
            # ポリシー数確認
            if len(self.policies) > 0:
                return "healthy"
            else:
                return "no_policies_loaded"

        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return "error"

    async def check_compliance(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """コンプライアンスチェック"""

        if not self.is_initialized:
            raise Exception("Policy Manager Agent not initialized")

        message = data.get("message", "")
        user_id = data.get("user_id", "")

        try:
            # 全社共通ポリシー取得（部署区分なし）
            applicable_policies = await self._get_applicable_policies(user_id)

            # 各ポリシーに対してチェック実行
            violations = []
            warnings = []

            for policy in applicable_policies:
                result = await self._check_single_policy(message, policy)

                if result["violation"]:
                    violations.append(
                        {
                            "policy_id": policy["id"],
                            "policy_name": policy["name"],
                            "violation_type": result["violation_type"],
                            "severity": result["severity"],
                            "description": result["description"],
                            "matched_patterns": result.get(
                                "matched_patterns", []
                            ),
                        }
                    )
                elif result["warning"]:
                    warnings.append(
                        {
                            "policy_id": policy["id"],
                            "policy_name": policy["name"],
                            "warning_type": result["warning_type"],
                            "description": result["description"],
                            "recommendations": result.get(
                                "recommendations", []
                            ),
                        }
                    )

            # 結果生成
            compliance_result = {
                "compliant": len(violations) == 0,
                "violations": violations,
                "warnings": warnings,
                "total_policies_checked": len(applicable_policies),
                "check_timestamp": datetime.utcnow().isoformat(),
            }

            logger.info(
                f"Compliance check completed for user {user_id}: {len(violations)} violations, {len(warnings)} warnings"
            )

            return compliance_result

        except Exception as e:
            logger.error(f"Compliance check failed: {e}")
            return self._create_error_response(str(e))

    async def _get_applicable_policies(
        self, user_id: str
    ) -> List[Dict[str, Any]]:
        """適用可能なポリシー取得（全社共通ポリシーのみ）"""

        applicable_policies = []

        for policy_id, policy in self.policies.items():
            # 全社共通ポリシーまたはユーザー固有ポリシーを適用
            if self._is_policy_applicable(policy, user_id):
                applicable_policies.append(policy)

        return applicable_policies

    def _is_policy_applicable(
        self, policy: Dict[str, Any], user_id: str
    ) -> bool:
        """ポリシー適用可否判定（部署区分なし）"""

        # 全社適用ポリシー（デフォルト）
        if policy.get("scope") == "company_wide" or not policy.get("scope"):
            return True

        # ユーザー固有ポリシー
        if policy.get("scope") == "user_specific":
            applicable_users = policy.get("applicable_users", [])
            if user_id in applicable_users:
                return True

        return False

    async def _check_single_policy(
        self, message: str, policy: Dict[str, Any]
    ) -> Dict[str, Any]:
        """単一ポリシーチェック"""

        result = {
            "violation": False,
            "warning": False,
            "violation_type": None,
            "warning_type": None,
            "severity": "low",
            "description": "",
            "matched_patterns": [],
            "recommendations": [],
        }

        try:
            policy_type = policy.get("type")

            if policy_type == "harassment_prevention":
                return await self._check_harassment_policy(message, policy)
            elif policy_type == "confidentiality":
                return await self._check_confidentiality_policy(
                    message, policy
                )
            elif policy_type == "communication_standards":
                return await self._check_communication_policy(message, policy)
            elif policy_type == "data_protection":
                return await self._check_data_protection_policy(
                    message, policy
                )
            else:
                # 汎用ポリシーチェック
                return await self._check_generic_policy(message, policy)

        except Exception as e:
            logger.error(f"Single policy check failed: {e}")
            result["warning"] = True
            result["warning_type"] = "policy_check_error"
            result["description"] = f"ポリシーチェックエラー: {str(e)}"

        return result

    async def _check_harassment_policy(
        self, message: str, policy: Dict[str, Any]
    ) -> Dict[str, Any]:
        """ハラスメント防止ポリシーチェック"""

        result = {
            "violation": False,
            "warning": False,
            "matched_patterns": [],
        }

        # 禁止表現チェック
        prohibited_phrases = policy.get("rules", {}).get(
            "prohibited_phrases", []
        )
        for phrase in prohibited_phrases:
            if re.search(phrase, message, re.IGNORECASE):
                result["violation"] = True
                result["violation_type"] = "prohibited_language"
                result["severity"] = "high"
                result["description"] = (
                    f"ハラスメント防止ポリシー違反: 禁止表現「{phrase}」が検出されました"
                )
                result["matched_patterns"].append(phrase)

        # 警告表現チェック
        warning_phrases = policy.get("rules", {}).get("warning_phrases", [])
        for phrase in warning_phrases:
            if re.search(phrase, message, re.IGNORECASE):
                result["warning"] = True
                result["warning_type"] = "potentially_inappropriate"
                result["description"] = (
                    f"注意: 不適切な可能性のある表現「{phrase}」が含まれています"
                )
                result["recommendations"].append(
                    "より適切な表現への変更を検討してください"
                )

        return result

    async def _check_confidentiality_policy(
        self, message: str, policy: Dict[str, Any]
    ) -> Dict[str, Any]:
        """機密保持ポリシーチェック"""

        result = {
            "violation": False,
            "warning": False,
            "matched_patterns": [],
        }

        # 機密情報パターンチェック
        confidential_patterns = policy.get("rules", {}).get(
            "confidential_patterns", {}
        )

        for pattern_name, pattern in confidential_patterns.items():
            if re.search(pattern, message, re.IGNORECASE):
                # 機密レベル判定
                severity = (
                    policy.get("rules", {})
                    .get("pattern_severity", {})
                    .get(pattern_name, "medium")
                )

                if severity == "critical":
                    result["violation"] = True
                    result["violation_type"] = "confidential_info_disclosure"
                    result["severity"] = "critical"
                    result["description"] = (
                        f"機密保持ポリシー違反: {pattern_name}情報の共有が検出されました"
                    )
                else:
                    result["warning"] = True
                    result["warning_type"] = "potential_confidential_info"
                    result["description"] = (
                        f"注意: {pattern_name}情報の可能性があります"
                    )
                    result["recommendations"].append(
                        "機密情報でないことを確認してから共有してください"
                    )

                result["matched_patterns"].append(pattern_name)

        return result

    async def _check_communication_policy(
        self, message: str, policy: Dict[str, Any]
    ) -> Dict[str, Any]:
        """コミュニケーション基準ポリシーチェック"""

        result = {"violation": False, "warning": False}

        rules = policy.get("rules", {})

        # 長さチェック
        max_length = rules.get("max_message_length")
        if max_length and len(message) > max_length:
            result["warning"] = True
            result["warning_type"] = "message_too_long"
            result["description"] = (
                f"メッセージが長すぎます（{len(message)}/{max_length}文字）"
            )
            result["recommendations"] = [
                "メッセージを簡潔にまとめることを検討してください"
            ]

        # 必須挨拶チェック
        require_greeting = rules.get("require_greeting", False)
        if require_greeting:
            greeting_patterns = rules.get("greeting_patterns", [])
            has_greeting = any(
                re.search(pattern, message, re.IGNORECASE)
                for pattern in greeting_patterns
            )

            if not has_greeting:
                result["warning"] = True
                result["warning_type"] = "missing_greeting"
                result["description"] = "挨拶が含まれていません"
                result["recommendations"] = [
                    "適切な挨拶を含めることを検討してください"
                ]

        return result

    async def _check_data_protection_policy(
        self, message: str, policy: Dict[str, Any]
    ) -> Dict[str, Any]:
        """データ保護ポリシーチェック"""

        result = {
            "violation": False,
            "warning": False,
            "matched_patterns": [],
        }

        # 個人情報パターンチェック
        pii_patterns = policy.get("rules", {}).get("pii_patterns", {})

        for pii_type, pattern in pii_patterns.items():
            if re.search(pattern, message, re.IGNORECASE):
                result["violation"] = True
                result["violation_type"] = "pii_disclosure"
                result["severity"] = "high"
                result["description"] = (
                    f"データ保護ポリシー違反: {pii_type}の共有が検出されました"
                )
                result["matched_patterns"].append(pii_type)

        return result

    async def _check_generic_policy(
        self, message: str, policy: Dict[str, Any]
    ) -> Dict[str, Any]:
        """汎用ポリシーチェック"""

        result = {
            "violation": False,
            "warning": False,
            "matched_patterns": [],
        }

        # 汎用ルールチェック
        rules = policy.get("rules", {})

        # 禁止キーワード
        if "prohibited_keywords" in rules:
            for keyword in rules["prohibited_keywords"]:
                if keyword.lower() in message.lower():
                    result["violation"] = True
                    result["violation_type"] = "prohibited_content"
                    result["severity"] = rules.get("severity", "medium")
                    result["description"] = (
                        f"ポリシー違反: 禁止キーワード「{keyword}」が検出されました"
                    )
                    result["matched_patterns"].append(keyword)

        return result

    async def _load_demo_policies(self):
        """デモ用ポリシー読み込み"""

        # ハラスメント防止ポリシー
        self.policies["harassment_prevention"] = {
            "id": "harassment_prevention",
            "name": "ハラスメント防止ポリシー",
            "type": "harassment_prevention",
            "scope": "company_wide",
            "version": "1.0",
            "effective_date": "2024-01-01",
            "rules": {
                "prohibited_phrases": [
                    r"(?i)(ばか|あほ|くず|うざい|きもい)",
                    r"(?i)(stupid|idiot|fool|worthless)",
                    r"(?i)(しね|殺す|消えろ)",
                    r"(?i)(die|kill|disappear)",
                ],
                "warning_phrases": [
                    r"(?i)(がんばれよ|しっかりしろ)",
                    r"(?i)(もっと努力しろ|当然だ)",
                    r"(?i)(work harder|obviously|of course)",
                ],
            },
        }

        # 機密保持ポリシー
        self.policies["confidentiality"] = {
            "id": "confidentiality",
            "name": "機密保持ポリシー",
            "type": "confidentiality",
            "scope": "company_wide",
            "version": "1.0",
            "effective_date": "2024-01-01",
            "rules": {
                "confidential_patterns": {
                    "financial_data": r"(?i)(売上|利益|予算|budget|revenue|profit)[\s:：]*[\d,]+",
                    "customer_info": r"(?i)(顧客|クライアント|customer|client)[\s]*[A-Za-z\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+",
                    "business_secret": r"(?i)(新商品|新サービス|戦略|strategy|confidential)",
                    "internal_code": r"(?i)(password|token|key)[\s:=]+[A-Za-z0-9_-]+",
                    "salary_info": r"(?i)(給与|年収|salary|income)[\s:：]*\d+",
                },
                "pattern_severity": {
                    "financial_data": "critical",
                    "customer_info": "high",
                    "business_secret": "critical",
                    "internal_code": "critical",
                    "salary_info": "medium",
                },
            },
        }

        # コミュニケーション基準ポリシー
        self.policies["communication_standards"] = {
            "id": "communication_standards",
            "name": "コミュニケーション基準ポリシー",
            "type": "communication_standards",
            "scope": "company_wide",
            "version": "1.0",
            "effective_date": "2024-01-01",
            "rules": {
                "max_message_length": 500,
                "require_greeting": True,
                "greeting_patterns": [
                    r"(?i)(おはよう|こんにちは|お疲れ)",
                    r"(?i)(hello|hi|good morning|good afternoon)",
                    r"(?i)(いつもお世話になっております)",
                ],
            },
        }

        # データ保護ポリシー
        self.policies["data_protection"] = {
            "id": "data_protection",
            "name": "データ保護ポリシー",
            "type": "data_protection",
            "scope": "company_wide",
            "version": "1.0",
            "effective_date": "2024-01-01",
            "rules": {
                "pii_patterns": {
                    "email": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
                    "phone": r"\b\d{3}-\d{4}-\d{4}\b|\b\d{11}\b",
                    "credit_card": r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b",
                    "ssn": r"\b\d{3}-\d{2}-\d{4}\b",
                    "bank_account": r"\b\d{7,12}\b",
                    "personal_id": r"(?i)(個人番号|マイナンバー)[\s:：]*\d+",
                }
            },
        }

        logger.info(f"Loaded {len(self.policies)} demo policies")

    def _create_error_response(self, error_message: str) -> Dict[str, Any]:
        """エラーレスポンス生成"""
        return {
            "compliant": True,  # エラー時は安全側に倒す
            "violations": [],
            "warnings": [
                {
                    "policy_id": "system",
                    "policy_name": "システムエラー",
                    "warning_type": "policy_check_error",
                    "description": f"ポリシーチェックエラー: {error_message}",
                    "recommendations": ["システム管理者に連絡してください"],
                }
            ],
            "total_policies_checked": 0,
            "check_timestamp": datetime.utcnow().isoformat(),
            "error": error_message,
        }

    # 将来実装予定のメソッド
    async def update_policy(
        self, policy_id: str, policy_data: Dict[str, Any]
    ) -> bool:
        """ポリシー更新（Firestore連携）"""
        # TODO: Firestore実装後に実装
        pass

    async def get_policy_history(
        self, policy_id: str
    ) -> List[Dict[str, Any]]:
        """ポリシー履歴取得"""
        # TODO: Firestore実装後に実装
        pass

    async def create_custom_policy(self, policy_data: Dict[str, Any]) -> str:
        """カスタムポリシー作成"""
        # TODO: Firestore実装後に実装
        pass
