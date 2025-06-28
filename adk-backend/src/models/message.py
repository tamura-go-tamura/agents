"""
データモデル定義
"""

from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class RiskLevel(str, Enum):
    """リスクレベル"""

    SAFE = "safe"
    WARNING = "warning"
    DANGER = "danger"


class MessageAnalysisRequest(BaseModel):
    """メッセージ分析リクエスト"""

    message: str
    user_id: str
    department: str
    role: str = "member"
    channel_type: str = "public"  # "public", "private", "direct"
    timestamp: Optional[datetime] = None
    context: Optional[Dict[str, Any]] = {}


class MessageAnalysisResponse(BaseModel):
    """メッセージ分析レスポンス"""

    risk_level: RiskLevel
    confidence: float
    detected_issues: List[str] = []
    suggestions: List[str] = []
    flagged_content: List[str] = []
    compliance_notes: str = ""
    processing_time_ms: int


class ChatMessage(BaseModel):
    """チャットメッセージ"""

    id: str
    content: str
    sender_id: str
    channel_id: str
    timestamp: datetime
    analysis_result: Optional[MessageAnalysisResponse] = None
    is_sent: bool = True


class DemoUser(BaseModel):
    """デモユーザー"""

    id: str
    name: str
    email: str
    department: str  # 'engineering' | 'sales' | 'hr' | 'management'
    role: str  # 'member' | 'manager' | 'admin'
    avatar: Optional[str] = None


class PolicyRule(BaseModel):
    """ポリシールール"""

    id: str
    name: str
    description: str
    severity: str  # 'low' | 'medium' | 'high' | 'critical'
    prohibited_patterns: List[str]
    examples: Dict[str, List[str]]  # 'violation' | 'appropriate'


class CompanyPolicy(BaseModel):
    """企業ポリシー"""

    id: str
    department: str
    policy_type: str  # 'harassment' | 'confidential' | 'general'
    rules: List[PolicyRule]
    created_at: datetime
    updated_at: datetime
