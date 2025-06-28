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

    // ADKバックエンドに転送
    const adkResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/analyze-message`,
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
      return NextResponse.json(
        { error: 'Analysis service unavailable' },
        { status: 503 }
      );
    }

    const analysisResult = await adkResponse.json();
    return NextResponse.json(analysisResult);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
