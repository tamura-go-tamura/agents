/**
 * Message Analysis API Route
 * Firebase認証 + ADKバックエンド呼び出し
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps } from 'firebase-admin/app';

// Firebase Admin初期化（サーバーサイド）
if (!getApps().length) {
  try {
    // 本番環境では適切なservice account keyを使用
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

    // ADKバックエンドに転送して構造化レスポンスを取得
    const adkBackendUrl = process.env.ADK_BACKEND_URL || 'http://localhost:8080';
    
    try {
      const adkResponse = await fetch(
        `${adkBackendUrl}/api/analyze-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (!adkResponse.ok) {
        const errorData = await adkResponse.text();
        console.error('ADK Backend error:', errorData);
        
        // フォールバック応答
        return NextResponse.json({
          risk_level: 'SAFE',
          confidence: 0.5,
          detected_issues: [],
          suggestions: ["分析サービスが利用できませんでした"],
          flagged_content: [],
          processing_time_ms: 0,
          compliance_notes: "分析サービスエラー",
          detailed_analysis: {}
        });
      }

      const analysisResult = await adkResponse.json();
      return NextResponse.json(analysisResult);

    } catch (backendError) {
      console.error('ADK Backend connection error:', backendError);
      
      // フォールバック応答
      return NextResponse.json({
        risk_level: 'SAFE',
        confidence: 0.5,
        detected_issues: [],
        suggestions: ["バックエンドに接続できませんでした"],
        flagged_content: [],
        processing_time_ms: 0,
        compliance_notes: "接続エラー",
        detailed_analysis: {}
      });
    }

  } catch (error) {
    console.error('API error:', error);
    
    // エラー時のフォールバック応答
    return NextResponse.json({
      risk_level: 'SAFE',
      confidence: 0.5,
      detected_issues: [],
      suggestions: ["予期しないエラーが発生しました"],
      flagged_content: [],
      processing_time_ms: 0,
      compliance_notes: "システムエラー",
      detailed_analysis: {}
    });
  }
}
