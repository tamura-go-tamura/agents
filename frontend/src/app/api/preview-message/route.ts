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

    // ADKバックエンドのプレビューエンドポイントに転送
    const adkResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/preview-message`,
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
      console.error('ADK Backend preview error:', errorData);
      // エラー時はフォールバック応答
      return NextResponse.json({
        has_warnings: false,
        has_violations: false,
        preview_warnings: [],
        preview_violations: [],
        suggestion: "メッセージを送信できます"
      });
    }

    const previewResult = await adkResponse.json();
    return NextResponse.json(previewResult);

  } catch (error) {
    console.error('Preview API error:', error);
    // エラー時はフォールバック応答
    return NextResponse.json({
      has_warnings: false,
      has_violations: false,
      preview_warnings: [],
      preview_violations: [],
      suggestion: "メッセージを送信できます"
    });
  }
}
