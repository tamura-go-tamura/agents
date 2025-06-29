'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { loginWithGoogle } from '@/lib/firebase';
import {  AlertCircle, Shield, Eye, CheckCircle } from 'lucide-react';

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('Starting Google login...');
      await loginWithGoogle();
      console.log('Google login successful!');
    } catch (error) {
      console.error('Google login error:', error);
      let errorMessage = 'Googleログインに失敗しました';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        // Firebase specific error handling
        if (error.message.includes('auth/popup-blocked')) {
          errorMessage = 'ポップアップがブロックされました。ポップアップを許可して再試行してください。';
        } else if (error.message.includes('auth/popup-closed-by-user')) {
          errorMessage = 'ログインがキャンセルされました。';
        } else if (error.message.includes('auth/network-request-failed')) {
          errorMessage = 'ネットワークエラーが発生しました。接続を確認してください。';
        } else if (error.message.includes('auth/operation-not-allowed')) {
          errorMessage = 'Googleサインインが無効になっています。Firebase Consoleで有効にしてください。一時的にメール認証をご利用ください。';
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };




  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* ヒーローセクション */}
      <div className="relative overflow-hidden">
        {/* 背景の装飾的な要素 */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-indigo-400/20 to-pink-400/20 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* ヘッダー */}
          <div className="pt-12 pb-8">
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center space-x-3">
                <Image src="/logo.png" alt="SafeComm AI" width={48} height={48} className="h-12 w-12" />
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  チョットマッタ AI
                </h1>
              </div>
            </div>
            
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                AIによるコミュニケーションガードレールシステム
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Vertex AI を活用したリアルタイム分析で、<br />
                コンプライアンス違反や機密情報漏洩を未然・瞬時に検知
              </p>
            </div>
          </div>

          {/* メインコンテンツ - 2カラムレイアウト */}
          <div className="grid lg:grid-cols-2 gap-12 pb-12">
            {/* 左側: 特徴・メリット */}
            <div className="space-y-8">
              {/* 主要機能カード */}
              <div className="grid gap-6">
                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/20">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Eye className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">リアルタイム監視</h3>
                  </div>
                  <p className="text-gray-600">
                    チャットや対面コミュニケーションの内容を瞬時に分析し、リスクのある発言を即座に検知
                  </p>
                </div>

                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/20">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Shield className="w-5 h-5 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">高精度AI分析</h3>
                  </div>
                  <p className="text-gray-600">
                    Google Vertex AI Gemini の力で、文脈を理解した高度な分析を実現
                  </p>
                </div>

                
              </div>

              

            </div>

            {/* 右側: ログインフォーム */}
            <div className="flex justify-center">
              <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm shadow-2xl border border-white/20">
                <CardHeader className="text-center pb-1">
                  <div className="flex items-center justify-center space-x-2 mb-1">
                    
                    <CardTitle className="text-2xl font-bold text-gray-900">ログイン</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    variant="outline"
                    className="w-full h-12 border-2 hover:bg-gray-50 transition-all duration-200"
                  >
                    <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Google で続行
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-3 bg-white text-gray-500">または</span>
                    </div>
                  </div>

                  

                  {/* 機能ハイライト */}
                  <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                    <h4 className="font-semibold text-gray-900 text-sm mb-3 flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      主要機能
                    </h4>
                    <ul className="text-xs text-gray-700 space-y-2">
                      <li className="flex items-center">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></div>
                        リアルタイム通信監視
                      </li>
                      <li className="flex items-center">
                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-2"></div>
                        ハラスメント・機密情報リスク検出
                      </li>
                      <li className="flex items-center">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></div>
                        Vertex AI Gemini による高精度分析
                      </li>
                      <li className="flex items-center">
                        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mr-2"></div>
                        企業ポリシー違反検出
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* フッター */}
          <div className="border-t border-gray-200 pt-8 pb-12 text-center">
            <div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
              <span>© チョットマッタ AI</span>
              <span>•</span>
              <span>Powered by Vertex AI</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
