/**
 * Message Preview API Route
 * 送信前のリアルタイムメッセージプレビュー分析
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps } from 'firebase-admin/app';

// Firebase Admin初期化（サーバーサイド）
if (!getApps().length) {
  try {
    initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  } catch (error) {
    console.warn('Firebase Admin initialization failed:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authorizationヘッダーからトークンを取得
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing or invalid token' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];

    // Firebase ID tokenを検証
    let decodedToken;
    try {
      const adminAuth = getAuth();
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      );
    }

    // リクエストボディを取得
    const body = await request.json();
    
    // ユーザーIDが一致することを確認
    if (body.user_id !== decodedToken.email && body.user_id !== decodedToken.uid) {
      return NextResponse.json(
        { error: 'Forbidden: User ID mismatch' },
        { status: 403 }
      );
    }

    // ADKバックエンドの複数エンドポイントを呼び出し
    const adkBackendUrl = process.env.ADK_BACKEND_URL || 'http://localhost:8080';
    
    try {
      // ポリシーチェックとチャット分析を並行実行
      const [policyResponse, analysisResponse] = await Promise.all([
        fetch(`${adkBackendUrl}/api/policy-check`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: body.message,
            user_id: body.user_id,
            policies: [
              "No harassment or discriminatory language",
              "Keep communication professional", 
              "Protect confidential information",
              "Be respectful to all team members"
            ]
          }),
        }),
        fetch(`${adkBackendUrl}/api/analyze-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })
      ]);

      let policyResult = null;
      let analysisResult = null;

      if (policyResponse.ok) {
        policyResult = await policyResponse.json();
      }

      if (analysisResponse.ok) {
        analysisResult = await analysisResponse.json();
      }

      // 構造化されたレスポンスを作成
      const structuredResponse = {
        risk_level: policyResult?.violation_detected ? 'DANGER' : 
                   (analysisResult?.detailed_analysis?.risk_indicators?.length > 0 ? 'WARNING' : 'SAFE'),
        confidence: policyResult?.confidence_score || 0.85,
        detected_issues: policyResult?.violation_detected ? [policyResult.explanation] : [],
        suggestions: policyResult?.suggestions || [],
        flagged_content: policyResult?.keywords_detected || [],
        processing_time_ms: 100,
        compliance_notes: policyResult?.explanation,
        detailed_analysis: analysisResult?.detailed_analysis || {}
      };

      return NextResponse.json(structuredResponse);

    } catch (backendError) {
      console.error('ADK Backend error:', backendError);
      // フォールバック応答
      return NextResponse.json({
        risk_level: 'SAFE',
        confidence: 0.5,
        detected_issues: [],
        suggestions: ["バックエンドエラーのため分析できませんでした"],
        flagged_content: [],
        processing_time_ms: 0,
        compliance_notes: "分析サービスが利用できません",
        detailed_analysis: {}
      });
    }

  } catch (error) {
    console.error('Preview API error:', error);
    // エラー時はフォールバック応答
    return NextResponse.json({
      risk_level: 'SAFE',
      confidence: 0.5,
      detected_issues: [],
      suggestions: ["エラーのため分析できませんでした"],
      flagged_content: [],
      processing_time_ms: 0,
      compliance_notes: "分析中にエラーが発生しました",
      detailed_analysis: {}
    });
  }
}
