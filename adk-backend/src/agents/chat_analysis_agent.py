"""
Chat Analysis Agent - チャット分析エージェント
Vertex AI Gemini APIを使用したチャットメッセージのリアルタイム分析
"""

import asyncio
import logging
import re
from typing import Dict, Any, List, Optional
import time

# Vertex AI imports
from google.cloud import aiplatform
from vertexai.generative_models import GenerativeModel, Part

from src.config.settings import Settings
from src.models.message import RiskLevel

logger = logging.getLogger(__name__)


class ChatAnalysisAgent:
    """チャット分析Agent - Vertex AI Geminiベース"""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.model = None
        self.harassment_keywords = self._load_harassment_keywords()
        self.confidentiality_patterns = self._load_confidentiality_patterns()
        self.is_initialized = False

    async def initialize(self):
        """Agent初期化"""
        try:
            logger.info("Initializing Chat Analysis Agent...")

            # Vertex AI初期化
            aiplatform.init(
                project=self.settings.google_cloud_project,
                location=self.settings.google_cloud_location,
            )

            # Gemini モデル初期化
            self.model = GenerativeModel("gemini-1.5-pro")

            self.is_initialized = True
            logger.info("Chat Analysis Agent initialized successfully!")

        except Exception as e:
            logger.error(f"Failed to initialize Chat Analysis Agent: {e}")
            raise

    async def health_check(self) -> str:
        """ヘルスチェック"""
        if not self.is_initialized:
            return "not_initialized"

        try:
            # 簡単なテストクエリ
            test_prompt = "Test query. Reply with 'OK' only."
            response = await self._call_gemini(test_prompt, max_tokens=10)
            if response and "OK" in response.upper():
                return "healthy"
            else:
                return "unhealthy"

        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return "error"

    async def analyze(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """メッセージ分析メイン処理"""

        if not self.is_initialized:
            raise Exception("Chat Analysis Agent not initialized")

        start_time = time.time()
        message = data.get("message", "")
        user_id = data.get("user_id", "")

        try:
            # 並列で複数の分析を実行
            tasks = [
                self._analyze_harassment(message),
                self._analyze_confidentiality(message),
                self._analyze_sentiment(message),
                self._analyze_toxicity(message),
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # 結果統合
            harassment_result = (
                results[0] if not isinstance(results[0], Exception) else {}
            )
            confidentiality_result = (
                results[1] if not isinstance(results[1], Exception) else {}
            )
            sentiment_result = (
                results[2] if not isinstance(results[2], Exception) else {}
            )
            toxicity_result = (
                results[3] if not isinstance(results[3], Exception) else {}
            )

            # 最終分析結果生成
            analysis_result = self._compile_analysis_results(
                message,
                harassment_result,
                confidentiality_result,
                sentiment_result,
                toxicity_result,
            )

            # 処理時間追加
            processing_time = int((time.time() - start_time) * 1000)
            analysis_result["processing_time_ms"] = processing_time

            logger.info(
                f"Chat analysis completed for user {user_id} in {processing_time}ms"
            )

            return analysis_result

        except Exception as e:
            logger.error(f"Chat analysis failed: {e}")
            return self._create_error_response(str(e), start_time)

    async def _analyze_harassment(self, message: str) -> Dict[str, Any]:
        """ハラスメント分析"""

        # キーワードベース基本チェック
        detected_keywords = []
        for keyword in self.harassment_keywords:
            if keyword.lower() in message.lower():
                detected_keywords.append(keyword)

        # Gemini分析
        prompt = f"""
        以下のメッセージをハラスメントの観点で分析してください。
        
        メッセージ: "{message}"
        
        以下の形式でJSONで回答してください：
        {{
            "is_harassment": true/false,
            "confidence": 0.0-1.0,
            "harassment_type": "verbal_abuse|sexual_harassment|discrimination|bullying|none",
            "severity": "low|medium|high",
            "explanation": "簡潔な説明"
        }}
        """

        try:
            response = await self._call_gemini(prompt, max_tokens=200)
            gemini_result = self._parse_json_response(response)

            # キーワード検出とGemini分析を統合
            final_confidence = gemini_result.get("confidence", 0.0)
            if detected_keywords:
                final_confidence = min(final_confidence + 0.2, 1.0)

            return {
                "is_harassment": gemini_result.get("is_harassment", False)
                or bool(detected_keywords),
                "confidence": final_confidence,
                "harassment_type": gemini_result.get(
                    "harassment_type", "none"
                ),
                "severity": gemini_result.get("severity", "low"),
                "detected_keywords": detected_keywords,
                "explanation": gemini_result.get("explanation", ""),
            }

        except Exception as e:
            logger.error(f"Harassment analysis failed: {e}")
            # フォールバック：キーワードベースのみ
            return {
                "is_harassment": bool(detected_keywords),
                "confidence": 0.7 if detected_keywords else 0.1,
                "harassment_type": (
                    "verbal_abuse" if detected_keywords else "none"
                ),
                "severity": "medium" if detected_keywords else "low",
                "detected_keywords": detected_keywords,
                "explanation": "AI分析失敗、キーワードベース分析のみ",
            }

    async def _analyze_confidentiality(self, message: str) -> Dict[str, Any]:
        """機密情報分析"""

        # パターンベース基本チェック
        detected_patterns = []
        for pattern_name, pattern in self.confidentiality_patterns.items():
            if re.search(pattern, message, re.IGNORECASE):
                detected_patterns.append(pattern_name)

        # Gemini分析
        prompt = f"""
        以下のメッセージに機密情報や個人情報が含まれているか分析してください。
        
        メッセージ: "{message}"
        
        以下の形式でJSONで回答してください：
        {{
            "contains_confidential": true/false,
            "confidence": 0.0-1.0,
            "info_types": ["personal_info", "financial_data", "business_secret", "customer_data"],
            "risk_level": "low|medium|high",
            "explanation": "簡潔な説明"
        }}
        """

        try:
            response = await self._call_gemini(prompt, max_tokens=200)
            gemini_result = self._parse_json_response(response)

            # パターン検出とGemini分析を統合
            final_confidence = gemini_result.get("confidence", 0.0)
            if detected_patterns:
                final_confidence = min(final_confidence + 0.3, 1.0)

            return {
                "contains_confidential": gemini_result.get(
                    "contains_confidential", False
                )
                or bool(detected_patterns),
                "confidence": final_confidence,
                "info_types": gemini_result.get("info_types", []),
                "risk_level": gemini_result.get("risk_level", "low"),
                "detected_patterns": detected_patterns,
                "explanation": gemini_result.get("explanation", ""),
            }

        except Exception as e:
            logger.error(f"Confidentiality analysis failed: {e}")
            # フォールバック：パターンベースのみ
            return {
                "contains_confidential": bool(detected_patterns),
                "confidence": 0.8 if detected_patterns else 0.2,
                "info_types": detected_patterns,
                "risk_level": "high" if detected_patterns else "low",
                "detected_patterns": detected_patterns,
                "explanation": "AI分析失敗、パターンベース分析のみ",
            }

    async def _analyze_sentiment(self, message: str) -> Dict[str, Any]:
        """感情分析"""

        prompt = f"""
        以下のメッセージの感情を分析してください。
        
        メッセージ: "{message}"
        
        以下の形式でJSONで回答してください：
        {{
            "sentiment": "positive|negative|neutral",
            "confidence": 0.0-1.0,
            "emotional_intensity": 0.0-1.0,
            "dominant_emotion": "anger|joy|sadness|fear|surprise|disgust|neutral"
        }}
        """

        try:
            response = await self._call_gemini(prompt, max_tokens=150)
            return self._parse_json_response(response)

        except Exception as e:
            logger.error(f"Sentiment analysis failed: {e}")
            return {
                "sentiment": "neutral",
                "confidence": 0.1,
                "emotional_intensity": 0.1,
                "dominant_emotion": "neutral",
            }

    async def _analyze_toxicity(self, message: str) -> Dict[str, Any]:
        """毒性分析"""

        prompt = f"""
        以下のメッセージの毒性レベルを分析してください。
        
        メッセージ: "{message}"
        
        以下の形式でJSONで回答してください：
        {{
            "is_toxic": true/false,
            "toxicity_score": 0.0-1.0,
            "toxicity_types": ["insult", "threat", "profanity", "identity_attack"],
            "explanation": "簡潔な説明"
        }}
        """

        try:
            response = await self._call_gemini(prompt, max_tokens=150)
            return self._parse_json_response(response)

        except Exception as e:
            logger.error(f"Toxicity analysis failed: {e}")
            return {
                "is_toxic": False,
                "toxicity_score": 0.1,
                "toxicity_types": [],
                "explanation": "AI分析失敗",
            }

    async def _call_gemini(self, prompt: str, max_tokens: int = 500) -> str:
        """Gemini API呼び出し"""
        try:
            response = await asyncio.to_thread(
                self.model.generate_content,
                prompt,
                generation_config={
                    "max_output_tokens": max_tokens,
                    "temperature": 0.1,
                    "top_p": 0.8,
                },
            )
            return response.text

        except Exception as e:
            logger.error(f"Gemini API call failed: {e}")
            raise

    def _parse_json_response(self, response: str) -> Dict[str, Any]:
        """GeminiレスポンスからJSON解析"""
        import json

        try:
            # JSONブロックを抽出
            json_start = response.find("{")
            json_end = response.rfind("}") + 1

            if json_start == -1 or json_end == 0:
                raise ValueError("No JSON found in response")

            json_str = response[json_start:json_end]
            return json.loads(json_str)

        except Exception as e:
            logger.error(f"Failed to parse JSON response: {e}")
            return {}

    def _compile_analysis_results(
        self,
        message: str,
        harassment_result: Dict,
        confidentiality_result: Dict,
        sentiment_result: Dict,
        toxicity_result: Dict,
    ) -> Dict[str, Any]:
        """分析結果統合"""

        # リスクレベル判定
        risk_level = RiskLevel.SAFE
        detected_issues = []
        suggestions = []
        flagged_content = []

        # ハラスメント判定
        if harassment_result.get("is_harassment", False):
            if harassment_result.get("severity") == "high":
                risk_level = RiskLevel.DANGER
            elif risk_level == RiskLevel.SAFE:
                risk_level = RiskLevel.WARNING

            detected_issues.append("harassment_detected")
            suggestions.append(
                "ハラスメントの可能性があります。適切な表現に変更してください。"
            )
            flagged_content.extend(
                harassment_result.get("detected_keywords", [])
            )

        # 機密情報判定
        if confidentiality_result.get("contains_confidential", False):
            if confidentiality_result.get("risk_level") == "high":
                risk_level = RiskLevel.DANGER
            elif risk_level == RiskLevel.SAFE:
                risk_level = RiskLevel.WARNING

            detected_issues.append("confidential_info_detected")
            suggestions.append(
                "機密情報の可能性があります。共有前に確認してください。"
            )
            flagged_content.extend(
                confidentiality_result.get("detected_patterns", [])
            )

        # 毒性判定
        if toxicity_result.get("is_toxic", False):
            if toxicity_result.get("toxicity_score", 0) > 0.7:
                risk_level = RiskLevel.DANGER
            elif risk_level == RiskLevel.SAFE:
                risk_level = RiskLevel.WARNING

            detected_issues.append("toxic_content")
            suggestions.append(
                "不適切な表現が含まれています。建設的な表現に変更してください。"
            )

        # 総合信頼度計算
        confidences = [
            harassment_result.get("confidence", 0.5),
            confidentiality_result.get("confidence", 0.5),
            sentiment_result.get("confidence", 0.5),
            toxicity_result.get("toxicity_score", 0.5),
        ]
        overall_confidence = sum(confidences) / len(confidences)

        return {
            "risk_level": risk_level,
            "confidence": overall_confidence,
            "detected_issues": detected_issues,
            "suggestions": suggestions,
            "flagged_content": list(set(flagged_content)),  # 重複除去
            "detailed_analysis": {
                "harassment": harassment_result,
                "confidentiality": confidentiality_result,
                "sentiment": sentiment_result,
                "toxicity": toxicity_result,
            },
        }

    def _create_error_response(
        self, error_message: str, start_time: float
    ) -> Dict[str, Any]:
        """エラーレスポンス生成"""
        processing_time = int((time.time() - start_time) * 1000)

        return {
            "risk_level": RiskLevel.WARNING,
            "confidence": 0.0,
            "detected_issues": ["analysis_error"],
            "suggestions": ["分析エラーが発生しました。再試行してください。"],
            "flagged_content": [],
            "error": error_message,
            "processing_time_ms": processing_time,
        }

    def _load_harassment_keywords(self) -> List[str]:
        """ハラスメントキーワード読み込み"""
        # 基本的なハラスメントキーワード（実際の運用では外部ファイルから読み込み）
        return [
            # 日本語
            "ばか",
            "あほ",
            "くず",
            "うざい",
            "きもい",
            "しね",
            "殺す",
            "消えろ",
            "セクハラ",
            "パワハラ",
            "いじめ",
            "差別",
            "暴力",
            "脅迫",
            # 英語
            "stupid",
            "idiot",
            "fool",
            "hate",
            "kill",
            "die",
            "ugly",
            "worthless",
            "harassment",
            "discrimination",
            "bullying",
            "threatening",
        ]

    def _load_confidentiality_patterns(self) -> Dict[str, str]:
        """機密情報パターン読み込み"""
        return {
            "email": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
            "phone": r"\b\d{3}-\d{4}-\d{4}\b|\b\d{11}\b",
            "credit_card": r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b",
            "ssn": r"\b\d{3}-\d{2}-\d{4}\b",
            "bank_account": r"\b\d{7,12}\b",
            "password": r"(?i)(password|pass|pwd)[\s:=]+\S+",
            "api_key": r"(?i)(api[_-]?key|token)[\s:=]+[A-Za-z0-9_-]+",
            "confidential": r"(?i)(機密|秘密|confidential|secret|private)",
            "salary": r"(?i)(給与|年収|salary|income)[\s:：]*\d+",
            "personal_id": r"(?i)(個人番号|マイナンバー|personal[_\s]?id)[\s:：]*\d+",
        }
