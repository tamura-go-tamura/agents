# チョットマッタAI - 機能要件定義書

## 📋 必須条件対応状況

### Google Cloud アプリケーション関連サービス
- ✅ **Cloud Run**: ADKバックエンドのホスティング
- ✅ **Cloud Run functions**: リアルタイム通知とイベント処理

### Google Cloud AI技術
- ✅ **Agent Development Kit (ADK)** ⭐️: コア機能の中心技術
- ✅ **Gemini API in Vertex AI**: 高精度な文脈理解とリスク検知
- ✅ **Live API**: リアルタイム音声監視とストリーミング処理
- ✅ **Speech-to-Text**: 補完的な音声処理（フォールバック用）

## 🎯 機能要件

### 1. チャットコミュニケーション監視機能

#### 1.1 リアルタイムテキスト分析
**技術**: ADK + Gemini API in Vertex AI

**機能詳細**:
- チャット入力中のリアルタイム分析（300ms以内）
- モラハラ・パワハラ表現の検知
- 社外機密情報の漏洩リスク検知
- 不適切な言い回しの代替提案

**入力**: テキストメッセージ（最大1000文字）
**出力**: リスクレベル（安全/注意/危険）+ 改善提案

#### 1.2 コンテキスト参照機能
**技術**: ADK + 企業ドキュメントDB

**機能詳細**:
- 社内コンプライアンスガイドライン参照
- 過去の違反事例との照合
- 部署・役職別の発言ルール適用

**入力**: メッセージ + ユーザー情報 + 文脈履歴
**出力**: コンプライアンス適合性判定

#### 1.3 予防的介入システム
**技術**: ADK Agent Framework

**機能詳細**:
- 送信前警告表示
- 段階的エスカレーション（警告→ブロック→報告）
- 学習機能（ユーザーフィードバック反映）

### 2. 1on1音声監視機能

#### 2.1 リアルタイム音声分析
**技術**: Live API + ADK + Vertex AI Gemini API

**機能詳細**:
- WebSocketベースの連続音声ストリーミング
- Live APIによる超低レイテンシ音声処理（300ms以内）
- 自動音声アクティビティ検出（VAD）
- リアルタイム音声文字起こし
- 感情分析（怒り・威圧・不安検知）
- 発言パターン分析（一方的な会話の検知）
- プライバシー配慮（セッション自動削除）

**入力**: リアルタイム音声ストリーム（WebSocket経由）
**出力**: リアルタイム警告 + 音声文字起こし + 感情分析

#### 2.2 セッション分析レポート
**技術**: ADK + Vertex AI Gemini API advanced analysis

**機能詳細**:
- 会話バランス分析（発言時間比率）
- 感情推移グラフ
- 改善提案とコーチングヒント
- 匿名化処理済みデータ保存

**入力**: セッション全体の音声データ
**出力**: 包括的分析レポート（PDF/Web）

#### 2.3 プライバシー保護機能
**技術**: Live API + ADK セッション管理

**機能詳細**:
- Live APIセッションベースの一時的データ処理
- 音声データの暗号化WebSocket通信
- セッション終了時の自動データ削除
- セッション再開機能（必要時のみ）
- 同意管理システム
- 匿名化処理と監査ログ

**入力**: セッション管理設定
**出力**: プライバシー保護されたデータフロー

### 3. 管理ダッシュボード機能

#### 3.1 組織健全性監視
**技術**: ADK Analytics + Vertex AI

**機能詳細**:
- 部署別リスクレベル表示
- トレンド分析（週次/月次）
- 早期警告システム
- 匿名化統計データ

#### 3.2 改善提案エンジン
**技術**: ADK + Vertex AI Gemini API

**機能詳細**:
- データドリブンな改善案生成
- 研修プログラム推奨
- ベストプラクティス共有
- ROI計算機能

## 🔧 技術仕様

### ADKバックエンド設計原則
1. **ADKフル活用**: Agent Development Kitの全機能を調査・活用
2. **LLMラッピング**: 障害時のフォールバック機能実装
3. **スケーラビリティ**: Cloud Runでの自動スケーリング
4. **セキュリティ**: エンドツーエンド暗号化

### Next.jsフロントエンド設計原則
1. **App Router**: 標準採用
2. **TypeScript**: 必須（ESLintエラーゼロ）
3. **Server Actions**: API Routes不使用
4. **Component設計**:
   - `components/`: 汎用UI（shadcn/ui利用）
   - `app/chat/`: チャット専用コンポーネント
   - `app/monitoring/`: 1on1監視専用コンポーネント
   - `demo/`: 手動テストページ

### データハンドリング
- **リアルタイム更新**: Server Actions + useSWR
- **音声処理**: Live API WebSocket + リアルタイムストリーミング
- **状態管理**: nuqs（URL状態）+ React Context（最小限）

### Live API技術仕様
- **接続方式**: WebSocket（双方向通信）
- **音声形式**: PCM, 16kHz, 16bit（その他フォーマット対応）
- **レイテンシ**: 300ms以内
- **VAD**: 自動音声アクティビティ検出
- **セッション**: 最大10分（設定可能）
- **関数呼び出し**: ADKとの統合による外部システム連携
- **セキュリティ**: サーバー間認証（中間サーバー必須）

## 📊 パフォーマンス要件

### レスポンス時間
- チャット分析: < 300ms
- 音声リアルタイム: < 500ms  
- レポート生成: < 3秒

### 可用性
- システム稼働率: 99.9%
- ADK API可用性: 99.5%

### スケーラビリティ
- 同時接続ユーザー: 1000人
- 同時音声セッション: 100セッション

## 🛡️ セキュリティ要件

### データ保護
- 音声データ暗号化（AES-256）
- GDPR/個人情報保護法準拠
- 最小権限原則適用

### アクセス制御
- ロールベースアクセス制御
- 多要素認証対応
- 監査ログ完備

## 📋 テスト要件

### 手動テスト（demo/ディレクトリ）
- `/demo/chat-test`: チャット機能テストページ
- `/demo/voice-test`: 音声監視テストページ  
- `/demo/dashboard-test`: 管理画面テストページ
- `/demo/integration-test`: 統合テストシナリオ

### 自動テスト
- ユニットテスト（Jest）
- 統合テスト（Playwright）
- ADK API テスト

## 🚀 実装優先順位

### Phase 1（7月1-15日）
1. ADK基盤構築 + Cloud Run環境
2. チャットテキスト分析機能
3. 基本UI（Next.js + shadcn/ui）

### Phase 2（7月16-30日）  
1. 1on1音声監視機能
2. レポート生成機能
3. 管理ダッシュボード

### Phase 3（7月31日-8月5日）
1. UI/UX最適化
2. デモ環境整備
3. パフォーマンステューニング

---

*本機能要件書は、Google Cloud ハッカソン2024の審査基準（アイデアの質・問題解決の有効性・実現性）を満たすよう設計されています。*