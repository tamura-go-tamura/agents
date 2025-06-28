# SafeComm AI - Simplified Architecture

## 改善されたシンプルな実装

### 📁 ファイル構造
```
adk-backend/
├── src/
│   ├── utils/
│   │   └── llm_service_simple.py          # シンプルなADK LLMサービス
│   └── agents/
│       ├── policy_manager_agent_simple.py  # シンプルなポリシー管理
│       ├── chat_analysis_agent_simple.py   # シンプルなチャット解析
│       └── coordinator_simple.py           # シンプルなコーディネーター
├── test_simple.py                          # テストスクリプト
└── .env.example                            # 環境設定例
```

### 🎯 主な改善点

1. **大幅な簡素化**
   - 複雑なクラス継承を排除
   - 分かりやすい関数名とデータ構造
   - 最小限の依存関係

2. **ADKの正しい使用**
   - ADK公式サンプルのパターンに準拠
   - `Agent`, `InMemoryRunner`, `InMemorySessionService`を適切に使用
   - ツール関数の正しい定義

3. **エラーハンドリング**
   - フォールバックモード（ADK利用不可時）
   - 各段階でのエラーキャッチ
   - 分かりやすいログ出力

4. **データ構造の明確化**
   - `@dataclass`を使用した明確な型定義
   - 予測可能なレスポンス形式

### 🚀 使用方法

1. **基本テスト（現在動作可能）**:
   ```bash
   python test_simple.py
   ```

2. **API設定してフル機能を使う場合**:
   ```bash
   cp .env.example .env
   # .env ファイルでAPIキーを設定
   python test_simple.py
   ```

### 📋 各コンポーネント

#### SimpleLLMService
- ADKを使った統一LLMインターフェース
- ポリシーチェック用とチャット解析用の2つのエージェント
- フォールバック機能付き

#### SimplePolicyManagerAgent
- メッセージのポリシー準拠チェック
- 推奨事項の提供

#### SimpleChatAnalysisAgent
- 感情分析、毒性スコア、キートピック抽出
- 会話全体の洞察

#### SimpleCoordinator
- エージェント間の調整
- 並行処理による効率化

### ✅ 現在の状態

- ✅ ADK統合完了
- ✅ シンプルで理解しやすい構造
- ✅ フォールバック機能動作
- ✅ エラーハンドリング
- ✅ 基本テスト成功

次のステップ: APIキーを設定して完全なLLM機能をテスト
