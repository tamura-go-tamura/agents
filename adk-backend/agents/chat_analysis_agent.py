"""
チャット分析レポート生成用のマルチエージェントシステム

チャット全体の時系列分析、コンプライアンス違反検知、機密情報漏洩リスク分析を実行
"""

from google.adk.agents.llm_agent import LlmAgent
from google.adk.agents.parallel_agent import ParallelAgent
from google.adk.agents.sequential_agent import SequentialAgent
from google.genai import types
from dotenv import load_dotenv
import vertexai
import os

load_dotenv()

vertexai.init(
    project=os.getenv("GOOGLE_CLOUD_PROJECT"),
    location=os.getenv("GOOGLE_CLOUD_LOCATION"),
)

# 1. 時系列リスク分析エージェント
timeline_risk_agent = LlmAgent(
    name="timeline_risk_analyzer",
    description="チャット全体の時系列でのリスク推移を分析する",
    model="gemini-2.0-flash",
    instruction="""
あなたは時系列分析の専門エージェントです。

与えられたチャットメッセージ群を時系列で分析し、以下の観点から判定してください：

【分析観点】
- リスクレベルの推移（SAFE→WARNING→DANGER の変化）
- 会話の感情的な盛り上がり・沈静化
- 違反発言の頻度推移
- 参加者の発言パターン変化

【出力形式】
TIMELINE_ANALYSIS:
- overall_risk_trend: "increasing|decreasing|stable"
- risk_peaks: [{"timestamp": "時刻", "risk_level": "DANGER", "message": "発言内容"}]
- conversation_flow: "escalating|de-escalating|neutral"
- participant_analysis: [{"user": "ユーザー名", "risk_score": 0.0-1.0, "message_count": 数}]
- time_based_stats: {"safe_count": 数, "warning_count": 数, "danger_count": 数}

時系列の変化に着目して分析してください。
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

# 2. コンプライアンス総合分析エージェント
compliance_analysis_agent = LlmAgent(
    name="compliance_analyzer",
    description="チャット全体のコンプライアンス違反を総合分析する",
    model="gemini-2.0-flash",
    instruction="""
あなたはコンプライアンス分析の専門エージェントです。

チャット全体を通して、以下の違反項目を包括的に分析してください：

【違反項目】
- ハラスメント（パワハラ、セクハラ、モラハラ）
- 差別的発言（性別、年齢、国籍、宗教等）
- 暴言・攻撃的発言
- 脅迫・威嚇行為
- 不適切な表現・言語

【分析内容】
- 違反の種類・件数・深刻度
- 法的リスクの評価
- 違反者の特定
- 被害者への影響評価

【出力形式】
COMPLIANCE_ANALYSIS:
- total_violations: 数
- violation_breakdown: [{"type": "違反種別", "count": 数, "severity": "low|medium|high"}]
- legal_risk_level: "low|medium|high"
- recommended_actions: ["推奨対応策1", "推奨対応策2"]
- violation_details: [{"user": "ユーザー", "violation": "違反内容", "message": "発言", "timestamp": "時刻"}]

包括的なコンプライアンス評価を実施してください。
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

# 3. 機密情報総合分析エージェント
confidential_analysis_agent = LlmAgent(
    name="confidential_analyzer",
    description="チャット全体の機密情報漏洩リスクを総合分析する",
    model="gemini-2.0-flash",
    instruction="""
あなたは機密情報分析の専門エージェントです。

チャット全体を通して、機密情報の漏洩リスクを包括的に分析してください：

【機密情報カテゴリ】
- 個人情報（氏名、住所、電話番号、メール）
- 金融情報（口座、クレジットカード、金額）
- 技術情報（API、パスワード、システム情報）
- 営業秘密（顧客情報、価格、戦略）
- 社内情報（人事、組織、内部資料）

【分析内容】
- 機密情報の種類・件数・深刻度
- 漏洩リスクの評価
- 影響範囲の推定
- セキュリティ対策の必要性

【出力形式】
CONFIDENTIAL_ANALYSIS:
- total_leaks: 数
- leak_breakdown: [{"type": "情報種別", "count": 数, "risk_level": "low|medium|high"}]
- security_risk_level: "low|medium|high"
- data_types_exposed: ["個人情報", "技術情報"]
- leak_details: [{"type": "種別", "content": "内容", "user": "ユーザー", "timestamp": "時刻"}]
- mitigation_steps: ["対策1", "対策2"]

機密性の観点から厳密に評価してください。
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

# 4. レポート統合・JSON整形エージェント
report_formatter_agent = LlmAgent(
    name="report_formatter",
    description="分析結果を統合してレポート形式のJSONに整形する",
    model="gemini-2.0-flash",
    instruction="""
あなたはレポート整形の専門エージェントです。

前段の3つのエージェント（時系列分析、コンプライアンス分析、機密情報分析）の結果を受け取り、
包括的な分析レポートをJSON形式で生成してください：

【必須出力形式】
```json
{
  "summary": {
    "overall_risk_level": "SAFE|WARNING|DANGER",
    "total_messages": 数,
    "analysis_timestamp": "2025-01-15T10:30:00Z",
    "chat_duration_minutes": 数,
    "participants": ["ユーザー1", "ユーザー2"]
  },
  "compliance_report": {
    "total_violations": 数,
    "violation_rate": 0.0-1.0,
    "legal_risk_level": "low|medium|high",
    "violations": [
      {
        "type": "ハラスメント",
        "count": 数,
        "severity": "low|medium|high",
        "examples": ["発言例1", "発言例2"]
      }
    ],
    "recommended_actions": ["対応策1", "対応策2"]
  },
  "confidential_report": {
    "total_leaks": 数,
    "security_risk_level": "low|medium|high",
    "leak_types": [
      {
        "type": "個人情報",
        "count": 数,
        "risk_level": "low|medium|high"
      }
    ],
    "mitigation_steps": ["対策1", "対策2"]
  },
  "timeline_analysis": {
    "risk_trend": "increasing|decreasing|stable",
    "risk_timeline": [
      {
        "timestamp": "2025-01-15T10:30:00Z",
        "risk_level": "DANGER",
        "message": "発言内容",
        "user": "ユーザー名"
      }
    ],
    "participant_stats": [
      {
        "user": "ユーザー名",
        "message_count": 数,
        "risk_score": 0.0-1.0,
        "violations": 数
      }
    ]
  },
  "detailed_findings": [
    {
      "finding_id": 1,
      "type": "compliance_violation|confidential_leak",
      "severity": "low|medium|high",
      "description": "詳細説明",
      "message": "問題の発言",
      "user": "ユーザー名",
      "timestamp": "2025-01-15T10:30:00Z",
      "recommendation": "推奨対応"
    }
  ]
}
```

【重要事項】
- 必ずJSON形式のみを出力
- 説明文は含めない
- 全ての数値は実際の分析結果に基づく
- 時刻はISO 8601形式

包括的で実用的なレポートを生成してください。
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

# 並列実行エージェント（3つの分析を同時実行）
parallel_analysis_agent = ParallelAgent(
    name="parallel_chat_analyzer",
    sub_agents=[
        timeline_risk_agent,
        compliance_analysis_agent,
        confidential_analysis_agent,
    ],
)

# 全体のオーケストラエージェント（並列分析 → レポート統合）
chat_analysis_orchestrator = SequentialAgent(
    name="chat_analysis_orchestrator",
    sub_agents=[parallel_analysis_agent, report_formatter_agent],
)
