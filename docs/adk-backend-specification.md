# ADKバックエンド技術仕様書 - チャット機能

## 🎯 概要

Google Cloud Agent Development Kit (ADK)を活用したチャットコミュニケーション監視システムの詳細技術仕様です。

## 🏗️ ADK実装アーキテクチャ

### 基本構成
```python
# ADKエージェント構成
from google.adk.agents import LlmAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.artifacts.in_memory_artifact_service import InMemoryArtifactService

# チャット監視専用エージェント
def create_chat_analysis_agent():
    agent_instruction = """
    あなたは企業コミュニケーション監視AIアシスタントです。
    以下の観点でメッセージを分析してください:
    1. モラハラ・パワハラ表現の検知
    2. 社外機密情報の漏洩リスク
    3. コンプライアンス違反の可能性
    4. 建設的な代替表現の提案
    """
    
    return LlmAgent(
        model="gemini-2.0-flash-exp",
        name="chat_monitor",
        instruction=agent_instruction,
        tools=[
            PolicyCheckerTool(),
            ConfidentialityTool(),
            SuggestionGeneratorTool()
        ]
    )
```

## 🔧 技術スタック詳細

### 1. ADKコア依存関係
```python
# requirements.txt (ADK部分)
google-adk==1.1.1
google-cloud-aiplatform[adk, agent_engines]==1.95.1
google-genai>=1.5.0,<2.0.0
pydantic>=2.10.6,<3.0.0
absl-py>=2.2.1,<3.0.0
fastapi
uvicorn[standard]
websocket
cloudpickle
```

### 2. Cloud Run環境設定
```dockerfile
# Dockerfile
FROM python:3.11
COPY requirements.txt /tmp
RUN pip install -r /tmp/requirements.txt

WORKDIR /code
COPY . /code/

# 環境変数設定
ENV ENVIRONMENT="production"
ENV GOOGLE_CLOUD_PROJECT=""
ENV GOOGLE_CLOUD_LOCATION="us-central1"
ENV ADK_CONFIG_PATH="/code/config/adk_config.json"

EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

## 🎮 ADKエージェント実装

### 1. メインエージェント定義
```python
# src/agents/chat_monitor_agent.py
from google.adk.agents import LlmAgent
from google.adk.tools import Tool
from typing import Dict, Any

class ChatMonitorAgent:
    def __init__(self):
        self.session_service = InMemorySessionService()
        self.artifacts_service = InMemoryArtifactService()
        
        # メインエージェント
        self.root_agent = LlmAgent(
            model="gemini-2.0-flash-exp",
            name="chat_monitor_root",
            instruction=self._get_system_instruction(),
            tools=self._get_tools()
        )
        
        # ランナー設定
        self.runner = Runner(
            session_service=self.session_service,
            artifacts_service=self.artifacts_service
        )
    
    def _get_system_instruction(self) -> str:
        return """
        あなたは企業コミュニケーション保護の専門家です。
        
        【主要タスク】
        1. リアルタイムメッセージ分析
        2. リスクレベル判定（safe/warning/danger）
        3. 改善提案生成
        4. コンプライアンス適合性確認
        
        【分析観点】
        - モラハラ・パワハラ表現
        - 社外機密情報の言及
        - 不適切な言い回し
        - 建設的でない表現
        
        【出力形式】
        必ずJSON形式で以下を返してください:
        {
          "risk_level": "safe|warning|danger",
          "confidence": 0.0-1.0,
          "flagged_content": ["フラグされた内容"],
          "suggestions": ["改善提案1", "改善提案2"],
          "compliance_notes": "コンプライアンス観点での注記"
        }
        """
    
    def _get_tools(self) -> List[Tool]:
        return [
            PolicyCheckerTool(),
            ConfidentialityAnalyzer(),
            ToxicityDetector(),
            SuggestionGenerator()
        ]
    
    async def analyze_message(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """メッセージをリアルタイム分析"""
        session_id = f"chat_analysis_{context.get('user_id', 'unknown')}"
        
        # コンテキスト情報を含むプロンプト作成
        analysis_prompt = f"""
        【分析対象メッセージ】
        {message}
        
        【コンテキスト情報】
        - ユーザー部署: {context.get('department', 'unknown')}
        - 送信先: {context.get('channel_type', 'unknown')}
        - 時刻: {context.get('timestamp', 'unknown')}
        
        上記メッセージを分析し、JSON形式で結果を返してください。
        """
        
        # ADKランナーで実行
        response = await self.runner.run(
            agent=self.root_agent,
            session_id=session_id,
            message=analysis_prompt
        )
        
        return self._parse_response(response)
    
    def _parse_response(self, response) -> Dict[str, Any]:
        """ADKレスポンスをパース"""
        try:
            # JSONレスポンスをパース
            import json
            result = json.loads(response.message.content)
            return result
        except:
            # フォールバック処理
            return {
                "risk_level": "warning",
                "confidence": 0.5,
                "flagged_content": ["解析エラー"],
                "suggestions": ["メッセージを再確認してください"],
                "compliance_notes": "システムエラーにより詳細分析ができませんでした"
            }
```

### 2. カスタムツール実装
```python
# src/tools/policy_checker.py
from google.adk.tools import Tool
from google.cloud import firestore
import json

class PolicyCheckerTool(Tool):
    """企業ポリシーチェックツール"""
    
    name = "policy_checker"
    description = "企業のコンプライアンスポリシーに照らしてメッセージをチェック"
    
    def __init__(self):
        self.db = firestore.Client()
    
    async def execute(self, message: str, department: str) -> str:
        """ポリシーチェック実行"""
        
        # 部署別ポリシー取得
        policies = await self._get_department_policies(department)
        
        # 違反チェック
        violations = []
        for policy in policies:
            if self._check_violation(message, policy):
                violations.append({
                    "policy_id": policy["id"],
                    "policy_name": policy["name"],
                    "severity": policy["severity"],
                    "description": policy["description"]
                })
        
        return json.dumps({
            "violations": violations,
            "policy_status": "compliant" if not violations else "violation_detected"
        })
    
    async def _get_department_policies(self, department: str):
        """部署別ポリシー取得"""
        policies_ref = self.db.collection('company_policies')
        query = policies_ref.where('departments', 'array_contains', department)
        docs = query.stream()
        
        return [doc.to_dict() for doc in docs]
    
    def _check_violation(self, message: str, policy: dict) -> bool:
        """ポリシー違反チェック"""
        prohibited_patterns = policy.get('prohibited_patterns', [])
        for pattern in prohibited_patterns:
            if pattern.lower() in message.lower():
                return True
        return False

class ConfidentialityAnalyzer(Tool):
    """機密情報検出ツール"""
    
    name = "confidentiality_analyzer"
    description = "社外機密情報の検出と分類"
    
    async def execute(self, message: str) -> str:
        """機密情報分析実行"""
        
        confidential_keywords = [
            "売上", "利益", "顧客リスト", "戦略", "計画",
            "契約", "価格", "コスト", "予算", "人事情報"
        ]
        
        detected_items = []
        risk_level = "safe"
        
        for keyword in confidential_keywords:
            if keyword in message:
                detected_items.append(keyword)
                risk_level = "warning"
        
        # 具体的な数値や固有名詞が含まれる場合は危険レベル
        if any(char.isdigit() for char in message) and detected_items:
            risk_level = "danger"
        
        return json.dumps({
            "detected_confidential_items": detected_items,
            "risk_level": risk_level,
            "recommendation": "社外共有前に情報分類を確認してください" if detected_items else "問題なし"
        })

class SuggestionGenerator(Tool):
    """改善提案生成ツール"""
    
    name = "suggestion_generator"
    description = "より適切な表現への改善提案を生成"
    
    async def execute(self, message: str, issues: list) -> str:
        """改善提案生成"""
        
        suggestions = []
        
        # 問題別改善提案
        for issue in issues:
            if "harsh_tone" in issue:
                suggestions.append("より建設的な表現を検討してください: 「一緒に改善方法を考えましょう」")
            elif "confidential" in issue:
                suggestions.append("機密情報は「概要レベル」や「公開範囲」で表現してください")
            elif "inappropriate" in issue:
                suggestions.append("プロフェッショナルな表現に変更することをお勧めします")
        
        return json.dumps({
            "suggestions": suggestions,
            "alternative_phrases": self._generate_alternatives(message)
        })
    
    def _generate_alternatives(self, message: str) -> list:
        """代替表現生成"""
        # 簡単なパターンマッチング（実際はもっと高度な処理）
        alternatives = []
        
        if "ダメ" in message:
            alternatives.append("改善の余地があります")
        if "無理" in message:
            alternatives.append("課題がありますが、解決策を検討しましょう")
        
        return alternatives
```

## 🚀 FastAPI統合

### 1. メインアプリケーション
```python
# main.py
from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
import asyncio
from src.agents.chat_monitor_agent import ChatMonitorAgent
from src.models.message import MessageAnalysisRequest, MessageAnalysisResponse

app = FastAPI(title="チョットマッタ Chat Monitor API")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.jsフロントエンド
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ADKエージェント初期化
chat_agent = ChatMonitorAgent()

@app.post("/api/analyze-message", response_model=MessageAnalysisResponse)
async def analyze_message(request: MessageAnalysisRequest):
    """メッセージ分析API"""
    try:
        result = await chat_agent.analyze_message(
            message=request.message,
            context={
                "user_id": request.user_id,
                "department": request.department,
                "channel_type": request.channel_type,
                "timestamp": request.timestamp
            }
        )
        
        return MessageAnalysisResponse(**result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/realtime-analysis")
async def websocket_endpoint(websocket: WebSocket):
    """リアルタイム分析WebSocket"""
    await websocket.accept()
    
    try:
        while True:
            # メッセージ受信
            data = await websocket.receive_text()
            request_data = json.loads(data)
            
            # 分析実行
            result = await chat_agent.analyze_message(
                message=request_data["message"],
                context=request_data["context"]
            )
            
            # 結果送信
            await websocket.send_text(json.dumps(result))
            
    except Exception as e:
        await websocket.close(code=1000)

@app.get("/health")
async def health_check():
    """ヘルスチェック"""
    return {"status": "healthy", "adk_status": "active"}
```

### 2. データモデル定義
```python
# src/models/message.py
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class MessageAnalysisRequest(BaseModel):
    message: str
    user_id: str
    department: str
    channel_type: str  # "public", "private", "direct"
    timestamp: datetime

class MessageAnalysisResponse(BaseModel):
    risk_level: str  # "safe", "warning", "danger"
    confidence: float
    flagged_content: List[str]
    suggestions: List[str]
    compliance_notes: str
    processing_time_ms: int

class ChatMessage(BaseModel):
    id: str
    content: str
    sender_id: str
    channel_id: str
    timestamp: datetime
    analysis_result: Optional[MessageAnalysisResponse]
    is_sent: bool = True
```

## 📊 パフォーマンス最適化

### 1. キャッシュ戦略
```python
# src/cache/policy_cache.py
from functools import lru_cache
import asyncio
import time

class PolicyCache:
    def __init__(self):
        self._cache = {}
        self._cache_time = {}
        self.ttl = 3600  # 1時間

    @lru_cache(maxsize=128)
    async def get_department_policies(self, department: str):
        """部署ポリシーのキャッシュ取得"""
        cache_key = f"policies_{department}"
        
        if self._is_cache_valid(cache_key):
            return self._cache[cache_key]
        
        # データベースから取得
        policies = await self._fetch_policies_from_db(department)
        
        # キャッシュ更新
        self._cache[cache_key] = policies
        self._cache_time[cache_key] = time.time()
        
        return policies
    
    def _is_cache_valid(self, key: str) -> bool:
        if key not in self._cache_time:
            return False
        return time.time() - self._cache_time[key] < self.ttl
```

### 2. 非同期処理最適化
```python
# src/utils/async_analyzer.py
import asyncio
from concurrent.futures import ThreadPoolExecutor

class AsyncAnalyzer:
    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=4)
    
    async def batch_analyze(self, messages: List[str]) -> List[dict]:
        """バッチ分析処理"""
        tasks = []
        
        for message in messages:
            task = asyncio.create_task(
                self._analyze_single_message(message)
            )
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return [r for r in results if not isinstance(r, Exception)]
    
    async def _analyze_single_message(self, message: str) -> dict:
        """単一メッセージ分析"""
        loop = asyncio.get_event_loop()
        
        # CPU集約的な処理をスレッドプールで実行
        return await loop.run_in_executor(
            self.executor,
            self._sync_analysis,
            message
        )
```

## 🔒 セキュリティ実装

### 1. 認証・認可
```python
# src/auth/security.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from google.auth import jwt as google_jwt

security = HTTPBearer()

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """JWTトークン検証"""
    try:
        # Google Cloud Identity JWTの検証
        decoded_token = google_jwt.decode(
            credentials.credentials,
            verify=True,
            audience="your-project-id"
        )
        return decoded_token
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )

async def check_permissions(token: dict = Depends(verify_token)):
    """権限チェック"""
    user_role = token.get("role", "user")
    
    if user_role not in ["admin", "hr", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    return token
```

## 📋 設定ファイル

### 1. ADK設定
```json
// config/adk_config.json
{
  "project_id": "${GOOGLE_CLOUD_PROJECT}",
  "location": "${GOOGLE_CLOUD_LOCATION}",
  "model_config": {
    "name": "gemini-2.0-flash-exp",
    "temperature": 0.1,
    "max_output_tokens": 1024,
    "response_modalities": ["text"]
  },
  "agent_config": {
    "name": "chat_monitor",
    "instruction_template": "system_instruction.txt",
    "tools": [
      "policy_checker",
      "confidentiality_analyzer",
      "suggestion_generator"
    ]
  },
  "performance": {
    "timeout_seconds": 30,
    "retry_attempts": 3,
    "cache_ttl": 3600
  }
}
```

### 2. 環境変数
```bash
# .env
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
ENVIRONMENT=production

# ADK設定
ADK_CONFIG_PATH=/code/config/adk_config.json
ADK_SESSION_TTL=3600

# データベース
FIRESTORE_DATABASE=safecomm-policies
FIRESTORE_COLLECTION=company_policies

# API設定
API_RATE_LIMIT=100
WEBSOCKET_MAX_CONNECTIONS=1000

# セキュリティ
JWT_SECRET_KEY=your-secret-key
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com
```

---

この実装により、ADKの強力な機能を最大限活用しながら、高性能でスケーラブルなチャットコミュニケーション監視システムを構築できます。リアルタイム分析、カスタムツール、セキュリティ機能すべてが統合された堅牢なシステムとなります。
