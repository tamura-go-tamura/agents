# 🎯 チョットマッタ AI

**Google Cloud Vertex AI Multimodal Live API を使用したリアルタイム音声分析システム**

[![Cloud Run](https://img.shields.io/badge/Google%20Cloud-Run-4285f4.svg)](https://cloud.google.com/run)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688.svg)](https://fastapi.tiangolo.com/)
[![Vertex AI](https://img.shields.io/badge/Vertex%20AI-Live%20API-4285f4.svg)](https://cloud.google.com/vertex-ai)


## アーキテクチャ

![アーキテクチャ](./architecture.drawio.svg)

## 🌟 機能概要

- 🎤 **リアルタイム音声分析**: Vertex AI Multimodal Live APIによる高精度な音声解析
- 🚨 **AI介入システム**: 危険な発言の検出と自動警告
- 💬 **チャット分析**: 会話の傾向分析とレポート生成
- 🌐 **Webアプリケーション**: 美しいモダンUI with Next.js
- ☁️ **クラウドネイティブ**: Google Cloud Run対応
- 🔄 **リアルタイム通信**: WebSocketによる双方向通信

## 🚀 クイックスタート

### ローカル開発

```bash
# リポジトリクローン
git clone <repository-url>
cd communication

# バックエンド起動
cd adk-backend
pip install -r requirements.txt
python start_server.py

# フロントエンド起動 (別ターミナル)
cd frontend
npm install
npm run dev
```

### Cloud Runデプロイ

```bash
# 1. Dockerイメージをビルド
docker build -t gcr.io/YOUR_PROJECT_ID/safecomm-ai .

# 2. イメージをプッシュ  
docker push gcr.io/YOUR_PROJECT_ID/safecomm-ai

# 3. service.yamlのプレースホルダーを実際の値に置き換え
# PROJECT_ID, REGION, PROJECT_NUMBERを編集

# 4. Cloud Runサービスをデプロイ
gcloud run services replace service.yaml --region=us-central1
```

## 📋 アーキテクチャ

```
┌─────────────────┐    WebSocket    ┌─────────────────┐
│   Frontend      │ ◄─────────────► │   Backend       │
│   (Next.js)     │                 │   (FastAPI)     │
│   Port: 3000    │                 │   Port: 8080    │
└─────────────────┘                 └─────────────────┘
                                             │
                                             ▼
                                  ┌─────────────────┐
                                  │   Vertex AI     │
                                  │   Live API      │
                                  └─────────────────┘
```

### Cloud Run統合アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                  Cloud Run Service                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │             Docker Container                            │ │
│  │  ┌──────────────┐  ┌──────────────────────────────────┐ │ │
│  │  │   FastAPI    │  │            Next.js               │ │ │
│  │  │  (Port 8080) │  │          (Port 3000)             │ │ │
│  │  └──────────────┘  └──────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 📁 プロジェクト構成

```
communication/
├── 📄 README.md                          # このファイル
├── 📄 VERTEX_AI_IMPLEMENTATION.md        # 実装・API仕様詳細
├──  Dockerfile                         # マルチステージビルド
├── ⚙️ service.yaml                       # Cloud Run サービス定義
│
├── 🖥️ frontend/                          # Next.js フロントエンド
│   ├── src/
│   │   ├── app/                          # App Router
│   │   ├── components/                   # Reactコンポーネント
│   │   │   ├── audio/                   # 音声分析UI
│   │   │   ├── chat/                    # チャット分析UI
│   │   │   ├── auth/                    # 認証UI
│   │   │   └── layout/                  # レイアウトコンポーネント
│   │   └── lib/                         # ユーティリティ
│   ├── package.json
│   └── next.config.ts                   # Next.js設定
│
├── 🐍 adk-backend/                       # Python バックエンド
│   ├── main.py                          # FastAPI アプリケーション
│   ├── requirements.txt                 # Python依存関係
│   ├── agents/                          # ADK エージェント
│   │   ├── message_analyzer_orchestrator.py
│   │   └── chat_analysis_agent.py
│   └── saved_audio/                     # 音声ファイル保存
│
└── 📚 docs/                             # ドキュメント
    ├── functional-requirements.md
    ├── agent-design.md
    └── chat-system-design.md
```

## 🛠️ 技術スタック

### フロントエンド
- **Next.js 14** - React フレームワーク
- **TypeScript** - 型安全性
- **Tailwind CSS** - スタイリング
- **Web Audio API** - 音声処理

### バックエンド  
- **FastAPI** - Python Webフレームワーク
- **Google ADK** - Agent Development Kit
- **WebSockets** - リアルタイム通信
- **Vertex AI Live API** - 音声分析

### インフラ
- **Google Cloud Run** - コンテナ実行環境
- **Artifact Registry** - コンテナレジストリ
- **Docker** - コンテナ化
- **service.yaml** - Cloud Run サービス定義

## 🎮 使用方法

### 1. 音声監視機能

1. Web アプリケーションにアクセス
2. `/audio` ページに移動
3. 「音声監視を開始」ボタンをクリック
4. リアルタイムで音声分析結果を確認

### 2. チャット分析機能

1. `/chat` ページに移動
2. チャットメッセージを入力
3. 「分析実行」でリアルタイム分析
4. 詳細レポートを確認

## 📊 API エンドポイント

### REST API
- `GET /health` - ヘルスチェック
- `POST /api/analyze-message` - メッセージ分析
- `POST /api/chat-analysis` - チャット分析

### WebSocket API
- `/ws/audio-analysis` - 音声分析WebSocket
- メッセージ形式は [VERTEX_AI_IMPLEMENTATION.md](./VERTEX_AI_IMPLEMENTATION.md) を参照

## 🔧 開発者向け

### ローカル開発環境

```bash
# バックエンド開発
cd adk-backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload

# フロントエンド開発
cd frontend
npm install
npm run dev
```

### デバッグモード

開発環境では以下の機能が利用可能:
- デモ用の文字起こし追加ボタン
- 警告シミュレーションボタン  
- 詳細なコンソールログ

## 🚨 トラブルシューティング

### よくある問題

1. **WebSocket接続エラー**
   - バックエンドサーバーの起動確認
   - ポート8080の利用可能性確認

2. **マイクアクセス拒否** 
   - ブラウザ設定でマイクアクセス許可
   - HTTPS環境での実行推奨

3. **Google Cloud認証エラー**
   - `gcloud auth application-default login`実行
   - プロジェクトでAI Platform API有効化確認

詳細は [VERTEX_AI_IMPLEMENTATION.md](./VERTEX_AI_IMPLEMENTATION.md) を参照

## 📝 ドキュメント

- 📖 [実装・API仕様詳細](./VERTEX_AI_IMPLEMENTATION.md)
-  [機能要件](./docs/functional-requirements.md)
- 🤖 [エージェント設計](./docs/agent-design.md)

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. Pull Requestを作成

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 🔗 関連リンク

- [Vertex AI Multimodal Live API](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/multimodal-live)
- [Google ADK Documentation](https://googleapis.github.io/python-genai/)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Next.js Documentation](https://nextjs.org/docs)

---

🎉 **Ready to deploy?** Edit `service.yaml` with your project details and run `gcloud run services replace service.yaml --region=us-central1`!
