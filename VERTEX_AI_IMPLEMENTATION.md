# チョットマッタ AI - Vertex AI Multimodal Live API 実装

このプロジェクトは、Google Cloud Vertex AI Multimodal Live APIを使用したリアルタイム音声分析システムです。

## 🎯 機能概要

- **リアルタイム音声分析**: Vertex AI Multimodal Live APIによる音声の文字起こしと分析
- **AI介入機能**: 危険な発言を検出した際の音声による警告
- **WebSocket通信**: フロントエンドとバックエンド間のリアルタイム通信
- **美しいUI**: 現代的でユーザーフレンドリーなインターフェース

## 🏗️ アーキテクチャ

```
Frontend (Next.js/React)
    ↓ WebSocket
Backend (Python WebSocket Server)
    ↓ Live API
Google Cloud Vertex AI Multimodal Live API
```

## 📁 プロジェクト構造

```
communication/
├── adk-backend/                    # Pythonバックエンド
│   ├── websocket_server.py        # WebSocketサーバー
│   ├── start_server.py            # サーバー起動スクリプト
│   ├── requirements.txt           # Python依存関係
│   └── .env.example              # 環境変数テンプレート
└── frontend/                      # Next.jsフロントエンド
    └── src/components/audio/
        └── AudioAnalysis.tsx      # 音声分析UI
```

## 🚀 セットアップ

### 1. バックエンドセットアップ

```bash
cd adk-backend

# 仮想環境作成（推奨）
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# または
# venv\Scripts\activate  # Windows

# 依存関係インストール
pip install -r requirements.txt

# 環境変数設定
cp .env.example .env
# .envファイルを編集してGoogle Cloudプロジェクト情報を設定
```

### 2. 環境変数設定

`.env`ファイルに以下を設定:

```bash
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_GENAI_USE_VERTEXAI=True
```

### 3. Google Cloud認証

```bash
# Google Cloud CLIでログイン
gcloud auth login
gcloud auth application-default login

# プロジェクト設定
gcloud config set project your-project-id

# 必要なAPIを有効化
gcloud services enable aiplatform.googleapis.com
```

### 4. サーバー起動

```bash
# バックエンドサーバー起動
cd adk-backend
python start_server.py
```

### 5. フロントエンド起動

```bash
# フロントエンド起動
cd frontend
npm run dev
```

## 🔧 使用方法

1. **フロントエンドアクセス**: `http://localhost:3000`にアクセス
2. **音声分析画面**: `/audio`ページに移動
3. **音声監視開始**: 「音声監視を開始」ボタンをクリック
4. **リアルタイム分析**: 音声がリアルタイムで分析され、結果が表示される

## 🎛️ 主要コンポーネント

### バックエンド (`websocket_server.py`)

- **SafeCommWebSocketServer**: メインのWebSocketサーバークラス
- **Live API連携**: Vertex AI Multimodal Live APIとの双方向通信
- **音声分析**: リアルタイムでの危険発言検出
- **AI介入**: 自動的な音声警告システム

### フロントエンド (`AudioAnalysis.tsx`)

- **音声ストリーミング**: マイクからの音声をリアルタイムでキャプチャ
- **WebSocket通信**: バックエンドとの双方向通信
- **リアルタイムUI**: 文字起こしと分析結果の表示
- **美しいアニメーション**: スライム状のマイクアイコン

## 📊 API仕様

### WebSocketメッセージ

#### クライアント→サーバー

```json
// セッション開始
{
  "type": "start_session",
  "config": {
    "language": "ja-JP",
    "model": "gemini-2.0-flash-live-preview-04-09"
  }
}

// 音声チャンク送信
{
  "type": "audio_chunk",
  "audio_data": "base64_encoded_audio_data"
}

// セッション停止
{
  "type": "stop_session"
}
```

#### サーバー→クライアント

```json
// 文字起こし結果
{
  "type": "transcription",
  "source": "user|ai",
  "text": "発話内容",
  "timestamp": 1234567890
}

// 分析結果
{
  "type": "speech_analysis",
  "risk_level": "SAFE|WARNING|DANGER",
  "confidence": 0.95,
  "detected_issues": ["不適切な表現"],
  "intervention_needed": true,
  "timestamp": 1234567890
}

// AI介入
{
  "type": "ai_intervention",
  "warning_message": "警告メッセージ",
  "detected_issues": ["問題点"],
  "timestamp": 1234567890
}
```

## 🛠️ 技術スタック

### バックエンド
- **Python 3.9+**
- **WebSockets**: リアルタイム通信
- **Google GenAI SDK**: Vertex AI Live API連携
- **asyncio**: 非同期処理

### フロントエンド
- **Next.js 14**: Reactフレームワーク
- **TypeScript**: 型安全性
- **Tailwind CSS**: スタイリング
- **Web Audio API**: 音声処理

## 🔊 音声処理詳細

### 音声形式
- **サンプルレート**: 16kHz
- **チャンネル数**: 1 (モノラル)
- **フォーマット**: PCM 16-bit
- **エンコーディング**: Base64

### 音声ストリーミング
1. **マイクキャプチャ**: `getUserMedia` API
2. **音声処理**: `AudioContext` + `ScriptProcessorNode`
3. **形式変換**: Float32 → Int16 → Base64
4. **リアルタイム送信**: WebSocket経由

## 🚨 エラーハンドリング

- **WebSocket接続エラー**: 自動再接続機能
- **マイクアクセスエラー**: ユーザーフレンドリーなエラーメッセージ
- **Live APIエラー**: エラーログとフォールバック処理
- **音声処理エラー**: グレースフルな処理継続

## 📈 パフォーマンス

- **低レイテンシ**: WebSocketとLive APIによる最小限の遅延
- **効率的な音声処理**: チャンクベースのストリーミング
- **メモリ管理**: 適切なリソースクリーンアップ

## 🔐 セキュリティ

- **認証**: Google Cloud Application Default Credentials
- **CORS設定**: 開発環境用の適切な設定
- **データ保護**: 音声データの適切な処理

## 🐛 トラブルシューティング

### よくある問題

1. **WebSocket接続失敗**
   - バックエンドサーバーが起動しているか確認
   - ポート8080が利用可能か確認

2. **マイクアクセス拒否**
   - ブラウザの設定でマイクアクセスを許可
   - HTTPSが必要な場合はローカル証明書を設定

3. **Google Cloud認証エラー**
   - `gcloud auth application-default login`を実行
   - 環境変数が正しく設定されているか確認

4. **Live APIエラー**
   - プロジェクトでAI Platform APIが有効化されているか確認
   - 課金アカウントが設定されているか確認

## 📚 開発者向け情報

### デバッグモード
開発環境では以下の機能が利用可能:
- デモ用の文字起こし追加ボタン
- 警告シミュレーションボタン
- 詳細なコンソールログ

### カスタマイズ
- 危険キーワードの調整: `websocket_server.py`の`analyze_speech_content`メソッド
- UI動作の調整: `AudioAnalysis.tsx`のアニメーション設定
- 音声設定の変更: Live API設定の`voice_name`など

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. Pull Requestを作成

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 🔗 関連リンク

- [Vertex AI Multimodal Live API Documentation](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/multimodal-live)
- [Google GenAI SDK](https://googleapis.github.io/python-genai/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
