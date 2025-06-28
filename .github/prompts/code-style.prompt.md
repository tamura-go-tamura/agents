#  ディレクトリ構成　

frontend/  Next.jsフロントエンド
adk-backend/ google cloudのADKを使用したバックエンド

## ADKバックエンドの原則

1. コア原則
	•	google cloudのADKを使用する
	•	不明点はgoogle cloud agent development kitのgithubを参照すること
	•	LLMが使えない場合のフォールバックが簡単にできるようにLLMはラップすること
	•	ADKの機能はフルに使えるようにADK機能はしっかりと調べること

## Next.jsの原則

1. コア原則
	•	App Router を標準採用
	•	TypeScript 必須（ESLint／型エラーは常にゼロ）
	•	API Routes は使用しない。あらゆるサーバー処理は Server Actions で実装

2. ディレクトリレイアウト

app/         ルーティング & ページ  
components/  汎用 UI（再利用可能・ロジックなし）  
lib/         ユーティリティ関数  
hooks/       カスタムフック  
types/       型定義  
constants/   定数  
config/      設定値・環境変数ラッパー  
services/    外部 API ラッパーやビジネスロジック  
demo/        フロントエンドから実行できる手動テストページ

	•	専用（機能固有）コンポーネント … 対応する page.tsx と同階層
	•	汎用（再利用可能）コンポーネント … components/ に配置

3. データハンドリング

依存条件	実装方法
ユーザー操作に依存しない	server components + Server Actions
ユーザー操作に依存する	client components + Server Actions + useSWR

	•	更新は Server Actions、即時反映は useSWR.mutate で楽観的更新
	•	Supabase は RLS + auth.uid() を利用し、user.id 明示は不要

4. 表示と状態管理
	•	UI は極力自作せず、必ず shadcn/ui のコンポーネントを利用
	•	アイコンは lucide-react を統一使用
	•	URL 状態は nuqs に統一
	•	グローバル状態ライブラリは 使用しない（必要時は React Context + useReducer などで最小構成）

5. パフォーマンス
	•	use client / useEffect / useState は最小限、まず RSC
	•	クライアント側は Suspense でフォールバック
	•	動的 import で遅延読み込み、画像は next/image、リンクは next/link
	•	ルートベースのコード分割を徹底

6. フォームとバリデーション
	•	制御コンポーネント + react-hook-form
	•	スキーマ検証は Zod
	•	クライアント／サーバー両方で入力チェック

7. 品質・セキュリティ・テスト

7-1 エラーハンドリング
	•	ガード節で 早期 return、成功パスは最後にまとめる

7-2 アクセシビリティ
	•	セマンティック HTML + ARIA、キーボード操作サポート

7-3 Server Actions のセキュリティ指針
	•	ユーザーが許可された操作だけを Server Action として実装
	•	汎用的・多目的なサーバー関数は実装しない
	•	RLS と auth.uid() により 最小権限 を担保

7-4 テスト
	•	demo/ ディレクトリ に UI ベースのテストページを配置し、
すべての Server Actions・クライアント関数を ブラウザ経由で手動検証 できるようにする

⸻

実装フロー
	1.	設計：コア原則とディレクトリ決定
	2.	データ：取得（useSWR）・更新（Server Actions＋mutate）ルール確立
	3.	UI / State：shadcn/ui と lucide-react を使い、URL 状態は nuqs
	4.	パフォーマンス：RSC・Suspense・dynamic import で最適化
	5.	フォーム & バリデーション：Zod × react-hook-form
	6.	品質管理：エラー処理 → アクセシビリティ → 専用 Server Actions → demo/ で手動テスト


# Hackathon rule
👩‍💻 開発プロジェクト条件
ご提出いただくプロジェクトは、以下の必須条件をすべて満たしている必要があります。

【必須条件】

1. Google Cloud アプリケーション関連サービスの利用

以下のいずれかの Google Cloud アプリケーション関連サービスを 1 つ以上 使用すること。

App Engine
Google Compute Engine
Google Kubernetes Engine
Cloud Run
Cloud Run functions（旧 Cloud Functions）
Cloud TPU
Cloud GPU
2. Google Cloud AI 技術の利用

以下のいずれかの Google、Google Cloud AI サービスを 1 つ以上 使用すること。

Google Cloud AI サービス (下記リストから 1 つ以上選択)
Vertex AI
Gemini API in Vertex AI
Google Agentspace
Vertex AI Agent Builder
Agent Development Kit ⭐️ Agent開発にはこれを使う！！
Agent Framework
Agent Garden
Agent Gallery
AgentOps
Vertex AI Agent Engine
Vertex Explainable AI
Vertex AI Model Optimizer
Vertex AI Model Development Service
Gen AI Evaluation
Vertex AI Vector Search
Recommendations AI
Translation AI
Conversational Agents
Contact Center as a Service
Agent Assist
Conversational Insights
AutoML
Text-to-speech
Speech-to-Text
Natural Language AI
Vision AI
Video AI
Immersive Stream for XR
Document AI
Live API
Veo
Lyria
Chirp
その他 Google Cloud AI サービス で利用したいものがあればお問い合わせください。
Gemini API（Vertex AI の Gemini API の利用を推奨しますが、プロジェクトの要件に応じて Gemini API を直接利用することも可能です。）
Gemma

<!-- 
🔵 本プロジェクトで実際に使用しているサービス:
- Agent Development Kit (ADK) ⭐️ 
- Gemini API in Vertex AI
- Vision AI (Phase 2予定)

🔴 本プロジェクトで使用していないサービス:
- Speech-to-Text (音声機能削除により不要)
- Natural Language AI (ADK中心の方針により不要)
- Text-to-speech (音声機能削除により不要)
-->
【任意条件 (特別賞対象)】

Flutter / Firebase の利用

必須条件に加え、Flutter または Firebase を利用しているプロジェクトは、特別賞（Flutter 賞、Firebase 賞）の審査対象となります。

その他の Google Cloud サービスの利用

必須条件に加え、Google Cloud の他のサービス（例: データベース、データ分析、セキュリティなど）を積極的に利用しているプロジェクトは、特別賞（Deep Dive 賞、Moonshot 賞）の審査対象となります。

📄 提出物
プロジェクトのGitHubリポジトリの URL
プロジェクトをデプロイしたURL
2025年6月30日～7月16日までの間は、デプロイした上で動作確認できる状態にしておいてください。
プロジェクトについて説明した Zenn の記事
文字数は 4000～6000 文字とし、カテゴリは「Idea」で投稿してください。
記事中に、下記 ⅰ~ⅲ を必ず含めてください。
ⅰ. プロジェクトが対象とするユーザー像と課題、課題へのソリューションと特徴をまとめた説明文
ⅱ. システム アーキテクチャ図の画像
ⅲ. プロジェクトの 3 分以内のデモ動画
※ デモ動画は自作の上、YouTube に公開し Zenn 記事に埋め込んでください。
※ X アカウントをお持ちの方は、ハッシュタグ #aiagentzenn と #googlecloud をつけて、投稿をお願いします。
GitHubリポジトリについて

Githubリポジトリは提出時点の状態を8月5日まで保ってください。
提出後も開発を継続したい場合、提出締め切り以前に作成されたタグをGitHubへプッシュし、提出フォームへはそのタグのURLを記載してください。
本ハッカソンはサービスアイデアと技術を用いた競技です。リポジトリは原則公開になりますのでご了承ください。
📏 審査基準
アイデアの質
アイデアの創造性と独創性について評価します。

問題の明確さと解決策の有効性
問題が明確に定義されているか、そして提案されたソリューションがその中心となる問題に効果的に対処し、解決しているかを評価します。

アイデアの実現
開発者がアイデアをどの程度実現し、必要なツールを活用し、拡張性があり、運用しやすく、費用対効果の高いソリューションを作成できたかを評価します。