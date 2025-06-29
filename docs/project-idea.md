# チョットマッタAI - AI監視型コミュニケーション保護システム

## 🎯 Google Cloud AI**: Agent Development Kit (ADK) ⭐️, Gemini API in Vertex AI, Live API

#### フロントエンド
- Next.js (App Router + TypeScript)
- shadcn/ui, lucide-react
- useSWR, nuqs

#### バックエンド
- Google Cloud ADK
- Vertex AI Gemini API
- Live API (リアルタイム音声処理)
- Cloud Run Functions### 対象ユーザー像
- **企業の人事・労務管理者**: 職場でのハラスメント防止とコンプライアンス強化を求める責任者
- **従業員**: 安全で健全なコミュニケーション環境を望む全ての社員
- **管理職**: 適切なマネジメントスキル向上を目指すリーダー層

### 解決する課題
1. **職場ハラスメントの早期発見・防止困難**: 1on1やチャットでのモラハラが見逃されがち
2. **社外機密情報の漏洩リスク**: 日常会話での意図しない機密情報の言及
3. **コンプライアンス違反の検知遅れ**: 不適切な発言の事後対応による組織ダメージ

### ソリューションの特徴
**リアルタイムAI監視 + 予防的コミュニケーション支援システム**

- 🤖 **Google Cloud ADK**を活用したインテリジェントなコミュニケーション分析
- 🛡️ **Vertex AI Gemini API**による高精度な文脈理解とリスク検知
- 🎤 **Live API**によるリアルタイム音声監視（300ms以内の超低レイテンシ）
- 🔒 **プライバシー配慮設計**で安心して利用可能

## 🏗️ システムアーキテクチャ

```
[Frontend (Next.js)]
    ↓ Real-time Communication
[ADK Backend (Cloud Run)]
    ↓ AI Analysis
[Vertex AI Gemini API]
    ↓ Policy Check
[Company Document DB]
    ↓ Alert & Report
[Notification System]
```

### 技術スタック

#### 必須条件対応
- **Google Cloud アプリケーション**: Cloud Run
- **Google Cloud AI**: Agent Development Kit (ADK) ⭐️, Gemini API in Vertex AI, Live API

#### フロントエンド
- Next.js (App Router + TypeScript)
- shadcn/ui, lucide-react
- useSWR, nuqs

#### バックエンド
- Google Cloud ADK
- Vertex AI Gemini API  
- Live API (WebSocket + リアルタイム音声)
- Cloud Run Functions

## 🎥 デモシナリオ（3分以内）

1. **チャット機能デモ（60秒）**
   - 社員がチャットで「新プロダクトの売上データを外部パートナーに共有しましょう」と入力
   - ADK + Vertex AI Gemini APIが即座に機密情報リスクを検知
   - 「社外機密に該当する可能性があります。『概要レベルの情報』として表現してはいかがでしょうか？」と代替提案

2. **1on1監視機能デモ（90秒）**
   - 管理職と部下の1on1セッション開始（音声入力）
   - 「君はいつも結果が出せないね」等の不適切発言をLive API + ADKが検知
   - リアルタイム警告：「建設的なフィードバック表現をお勧めします」
   - セッション終了後、会話バランス・感情分析を含む詳細レポート表示

3. **管理画面デモ（30秒）**
   - 組織全体のコミュニケーション健全性ダッシュボード
   - 部署別リスクトレンド + ADK基盤の改善提案
   - 「研修推奨部署」「ベストプラクティス事例」の自動表示

## 🚀 開発予定期間

**Phase 1 (7月前半)**: チャット監視機能 + ADK基盤構築
**Phase 2 (7月後半)**: 1on1音声監視機能 + レポート生成
**Demo準備**: UI/UX最適化 + デモ動画作成

---

*本プロジェクトは、Google Cloud ハッカソン 2024の要件に完全準拠し、ADKとVertex AIを中核技術として活用します。*
