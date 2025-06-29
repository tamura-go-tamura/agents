"""
マルチエージェント構成でのメッセージ分析システム

構成:
1. オーケストラエージェント（ParallelAgent + SequentialAgent）
2. SubAgent1: ハラスメント検知エージェント
3. SubAgent2: 機密情報検知エージェント
4. SubAgent3: JSON整形エージェント（逐次実行）
"""

from google.adk.agents.llm_agent import LlmAgent
from google.adk.agents.parallel_agent import ParallelAgent
from google.adk.agents.sequential_agent import SequentialAgent
from google.genai import types
from dotenv import load_dotenv
import vertexai
import os


load_dotenv()

print(os.getenv("GOOGLE_CLOUD_PROJECT"))

vertexai.init(
    project=os.getenv("GOOGLE_CLOUD_PROJECT"),
    location=os.getenv("GOOGLE_CLOUD_LOCATION"),
)


# 1. ハラスメント検知エージェント
harassment_detection_agent = LlmAgent(
    name="harassment_detector",
    description="チャットメッセージからハラスメントや不適切な表現を検知する",
    model="gemini-2.0-flash",
    instruction="""
あなたはハラスメント検知の専門エージェントです。

与えられたチャットメッセージを分析し、以下の観点から判定してください：

【判定基準】
- DANGER: 明確なハラスメント、脅迫、攻撃的な言動、差別的発言
- WARNING: 不適切な表現、相手を不快にさせる可能性がある言動
- SAFE: 健全で問題のないコミュニケーション

【検出対象】
- 暴言、侮辱、人格攻撃
- 性的ハラスメント
- パワーハラスメント
- 差別的発言
- 脅迫や威嚇

【出力形式】
以下の形式で必ず回答してください：
HARASSMENT_ANALYSIS:
- risk_level: SAFE|WARNING|DANGER
- detected_issues: [検出された問題のリスト]
- harassment_type: [ハラスメントの種類]
- severity: [深刻度 1-10]

感情分析も含めて判定し、簡潔に要点をまとめてください。
""",
    generate_content_config=types.GenerateContentConfig(
        safety_settings=[
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold=types.HarmBlockThreshold.OFF,
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=types.HarmBlockThreshold.OFF,
            ),
        ]
    ),
)


# 2. 機密情報検知エージェント
confidential_detection_agent = LlmAgent(
    name="confidential_detector",
    description="メッセージから機密情報や社外秘の内容を検知する",
    model="gemini-2.0-flash",
    instruction="""
あなたは機密情報検知の専門エージェントです。

【機密情報の判定基準】
以下のような情報が含まれていないかチェックしてください：

- 個人情報: 氏名、住所、電話番号、メールアドレス、生年月日
- 金融情報: クレジットカード番号、銀行口座、取引金額
- 技術情報: APIキー、パスワード、システム構成、ソースコード
- 営業秘密: 顧客リスト、価格情報、戦略情報、未発表製品情報
- 法的情報: 契約内容、法的文書、機密保持対象情報
- 社内情報: 人事情報、組織構成、内部資料

【判定レベル】
- DANGER: 明確な機密情報が含まれている
- WARNING: 機密情報の可能性がある内容
- SAFE: 機密情報は含まれていない

【出力形式】
以下の形式で必ず回答してください：
CONFIDENTIAL_ANALYSIS:
- risk_level: SAFE|WARNING|DANGER  
- detected_info_types: [検出された情報の種類]
- flagged_content: [問題となる具体的な内容]
- compliance_notes: [コンプライアンス上の注意点]

機密性の観点から慎重に判定してください。
""",
    generate_content_config=types.GenerateContentConfig(
        safety_settings=[
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=types.HarmBlockThreshold.OFF,
            ),
        ]
    ),
)


# 3. JSON整形エージェント
json_formatter_agent = LlmAgent(
    name="json_formatter",
    description="並列エージェントの分析結果を統合してJSON形式に整形する",
    model="gemini-2.0-flash",
    instruction="""
あなたはJSON整形の専門エージェントです。

前段の2つのエージェント（ハラスメント検知、機密情報検知）の分析結果を受け取り、
以下の形式でJSONに整形してください：

【必須出力形式】
```json
{
  "risk_level": "SAFE|WARNING|DANGER",
  "confidence": 0.0-1.0,
  "detected_issues": ["ーーという言葉が不適切です", "ーーは機密情報です"],
  "suggestions": ["ーーーのように表現すると良いでしょう", "--の共有は避けてください"],
  "flagged_content": ["池田さんの住所", "お前はクズだ"],
  "processing_time_ms": 2,
  "compliance_notes": 例："コンプライアンスに注意してください。",
  "detailed_analysis": {
    "sentiment": "positive|neutral|negative",
    "emotion": "happy|sad|angry|neutral|excited|worried",
    "communication_style": "説明",
    "risk_indicators": [
      {
        "type": "リスクの種類",
        "description": "説明", 
        "severity": "low|medium|high"
      }
    ],
    "policy_details": {
      "violation_type": "違反の種類",
      "severity": "low|medium|high",
      "keywords_detected": ["検出キーワード"]
    }
  }
}
```

【判定ロジック】
- 両方のエージェントの最高リスクレベルを採用
- すべての検出された問題を統合
- 適切な改善提案を生成
- 感情分析を含めた詳細分析を付与

必ずJSON形式のみを出力し、説明文は含めないでください。
""",
    generate_content_config=types.GenerateContentConfig(
        safety_settings=[
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=types.HarmBlockThreshold.OFF,
            ),
        ]
    ),
)


# 並列実行エージェント（ハラスメント検知 + 機密情報検知）
parallel_analysis_agent = ParallelAgent(
    name="parallel_analyzer",
    sub_agents=[harassment_detection_agent, confidential_detection_agent],
)


# 全体のオーケストラエージェント（並列 → 逐次でJSON整形）
message_analyzer_orchestrator = SequentialAgent(
    name="message_analyzer_orchestrator",
    sub_agents=[parallel_analysis_agent, json_formatter_agent],
)
