# SafeComm ADK Backend - シンプル構成

## 📁 ディレクトリ構造

```
adk-backend/
├── main.py                          # FastAPI サーバー（ADK統合）
├── requirements.txt                 # 依存関係
├── .env                            # 環境変数
└── src/
    └── agents/
        └── message_analyzer.py     # メッセージ分析ADKエージェント
```

## 🤖 Agent構成

### MessageAnalyzerAgent
- **モデル**: Gemini 2.0 Flash
- **役割**: チャットメッセージの安全性と感情分析
- **ツール**: 
  - `analyze_message_safety`: メッセージ安全性分析
  - `get_analysis_history`: 分析履歴取得

## 🔌 API エンドポイント

### `/api/analyze-message`
- **POST**: メッセージを分析してリスク判定と感情分析を返す
- **レスポンス**: 
  - `risk_level`: SAFE/WARNING/DANGER
  - `sentiment`: positive/neutral/negative
  - `emotion`: happy/sad/angry/neutral/excited/worried
  - `detected_issues`: 検出された問題
  - `suggestions`: 改善提案

### `/api/preview-message`
- **POST**: 軽量版のメッセージプレビュー分析

## 🚀 起動方法

```bash
cd adk-backend
python main.py
```

## ⚙️ 環境設定

`.env` ファイルに Google API Key を設定：
```
GOOGLE_API_KEY=your_google_api_key_here
```
