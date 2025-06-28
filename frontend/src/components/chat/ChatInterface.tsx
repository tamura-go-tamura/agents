'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { Send, AlertTriangle, Shield, Clock, User } from 'lucide-react';

interface AnalysisResult {
  risk_level: 'SAFE' | 'WARNING' | 'DANGER';
  confidence: number;
  detected_issues: string[];
  suggestions: string[];
  flagged_content: string[];
  processing_time_ms: number;
  detailed_analysis?: {
    harassment?: Record<string, unknown>;
    confidentiality?: Record<string, unknown>;
    sentiment?: Record<string, unknown>;
    toxicity?: Record<string, unknown>;
  };
}

interface PreviewResult {
  has_warnings: boolean;
  has_violations: boolean;
  preview_warnings: Array<{
    policy_name: string;
    warning_type: string;
    description: string;
  }>;
  preview_violations: Array<{
    policy_name: string;
    violation_type: string;
    description: string;
  }>;
  suggestion: string;
}

interface ChatMessage {
  id: string;
  content: string;
  timestamp: Date;
  user_id: string;
  user_name: string;
  analysis?: AnalysisResult;
}

export function ChatInterface() {
  const { user, logout } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [realtimeAnalysis, setRealtimeAnalysis] = useState<AnalysisResult | null>(null);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [isPreviewAnalyzing, setIsPreviewAnalyzing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000;

    // WebSocket接続関数を定義
    const connectWebSocket = () => {
      try {
        // 既存の接続があれば閉じる
        if (wsRef.current) {
          wsRef.current.close();
        }

        console.log('Attempting WebSocket connection to ws://localhost:8080/ws/realtime-analysis');
        wsRef.current = new WebSocket('ws://localhost:8080/ws/realtime-analysis');
        
        wsRef.current.onopen = (event) => {
          console.log('WebSocket connected successfully', event);
          reconnectAttempts = 0; // 再接続カウンターをリセット
        };
        
        wsRef.current.onmessage = (event) => {
          try {
            console.log('WebSocket message received:', event.data);
            const analysis: AnalysisResult = JSON.parse(event.data);
            setRealtimeAnalysis(analysis);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };
        
        wsRef.current.onerror = (error) => {
          console.error('WebSocket error details:', {
            error,
            readyState: wsRef.current?.readyState,
            url: wsRef.current?.url,
            protocol: wsRef.current?.protocol
          });
        };
        
        wsRef.current.onclose = (event) => {
          console.log('WebSocket disconnected:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            readyState: wsRef.current?.readyState
          });
          
          // 正常終了以外で、再接続試行回数が上限未満の場合は再接続
          if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
            setTimeout(connectWebSocket, reconnectDelay);
          }
        };
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        
        // 接続失敗時も再接続を試行
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          setTimeout(connectWebSocket, reconnectDelay);
        }
      }
    };

    // WebSocket接続
    connectWebSocket();
    
    // デモ用初期メッセージ
    addSystemMessage("SafeComm AI 通信監視システムが開始されました。メッセージを入力してリアルタイム分析を体験してください。");
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addSystemMessage = (content: string) => {
    const systemMessage: ChatMessage = {
      id: `system-${Date.now()}`,
      content,
      timestamp: new Date(),
      user_id: 'system',
      user_name: 'システム'
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !user) return;

    setIsAnalyzing(true);
    
    // メッセージ追加
    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      content: message,
      timestamp: new Date(),
      user_id: user.email || "",
      user_name: user.displayName || ""
    };

    setMessages(prev => [...prev, newMessage]);

    try {
      // Firebase IDトークンを取得
      const idToken = await user.getIdToken();
      
      // Next.js APIルート経由でメッセージ分析
      const response = await fetch('/api/analyze-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          message: message,
          user_id: user.email || "",
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        const analysis: AnalysisResult = await response.json();
        
        // 分析結果をメッセージに追加
        setMessages(prev => 
          prev.map(msg => 
            msg.id === newMessage.id 
              ? { ...msg, analysis }
              : msg
          )
        );

        // 危険レベルの場合は警告表示
        if (analysis.risk_level === 'DANGER') {
          addSystemMessage(`⚠️ 危険レベルのメッセージが検出されました: ${analysis.detected_issues.join(', ')}`);
        }
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      addSystemMessage('❌ 分析エラーが発生しました。システム管理者に連絡してください。');
    }

    setMessage('');
    setIsAnalyzing(false);
  };

  const handleRealtimeAnalysis = (value: string) => {
    setMessage(value);
    
    // 前のタイマーをクリア
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    
    // プレビュー分析を実行（デバウンス処理）
    if (value.trim()) {
      previewTimeoutRef.current = setTimeout(() => {
        performPreviewAnalysis(value);
      }, 500);
    } else {
      setPreviewResult(null);
    }
    
    if (value.trim() && wsRef.current?.readyState === WebSocket.OPEN && user) {
      // リアルタイム分析要求
      wsRef.current.send(JSON.stringify({
        message: value,
        user_id: user.email || "",
        timestamp: new Date().toISOString()
      }));
    } else {
      setRealtimeAnalysis(null);
    }
  };

  const performPreviewAnalysis = async (messageText: string) => {
    if (!messageText.trim() || !user) {
      setPreviewResult(null);
      return;
    }

    setIsPreviewAnalyzing(true);

    try {
      const idToken = await user.getIdToken();
      
      const response = await fetch('/api/preview-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          message: messageText,
          user_id: user.email || "",
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        const result: PreviewResult = await response.json();
        setPreviewResult(result);
      } else {
        setPreviewResult(null);
      }
    } catch (error) {
      console.error('Preview analysis failed:', error);
      setPreviewResult(null);
    } finally {
      setIsPreviewAnalyzing(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getRiskBadgeVariant = (riskLevel: string) => {
    switch (riskLevel) {
      case 'DANGER': return 'destructive';
      case 'WARNING': return 'default';
      default: return 'secondary';
    }
  };

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'DANGER': return <AlertTriangle className="h-4 w-4" />;
      case 'WARNING': return <Shield className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold">SafeComm AI 通信監視</h1>
            <Badge variant="outline">リアルタイム分析中</Badge>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-sm">
                  {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{user.displayName}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              ログアウト
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* チャットエリア */}
          <div className="lg:col-span-2">
            <Card className="h-[600px] flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>チャット</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {/* メッセージエリア */}
                <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.user_id === 'system' ? 'justify-center' : msg.user_id === (user.email || user.uid) ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        msg.user_id === 'system' 
                          ? 'bg-blue-100 text-blue-800 text-sm'
                          : msg.user_id === (user.email || user.uid)
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-200'
                      }`}>
                        {msg.user_id !== 'system' && (
                          <p className="text-xs opacity-75 mb-1">{msg.user_name}</p>
                        )}
                        <p className="text-sm">{msg.content}</p>
                        {msg.analysis && (
                          <div className="mt-2 pt-2 border-t border-white/20">
                            <div className="flex items-center space-x-2 mb-1">
                              {getRiskIcon(msg.analysis.risk_level)}
                              <Badge variant={getRiskBadgeVariant(msg.analysis.risk_level)} className="text-xs">
                                {msg.analysis.risk_level}
                              </Badge>
                              <span className="text-xs opacity-75">
                                {msg.analysis.processing_time_ms}ms
                              </span>
                            </div>
                            {msg.analysis.detected_issues.length > 0 && (
                              <p className="text-xs opacity-90 mt-1">
                                検出: {msg.analysis.detected_issues.join(', ')}
                              </p>
                            )}
                          </div>
                        )}
                        <p className="text-xs opacity-50 mt-1">
                          {msg.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* 入力エリア */}
                <div className="space-y-2">
                  {/* プレビュー分析結果表示 */}
                  {previewResult && (
                    <Alert className={`${
                      previewResult.has_violations 
                        ? 'border-red-500 bg-red-50' 
                        : previewResult.has_warnings 
                        ? 'border-yellow-500 bg-yellow-50' 
                        : 'border-green-500 bg-green-50'
                    }`}>
                      <div className="flex items-start space-x-2">
                        {previewResult.has_violations ? (
                          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                        ) : previewResult.has_warnings ? (
                          <Shield className="h-4 w-4 text-yellow-500 mt-0.5" />
                        ) : (
                          <Shield className="h-4 w-4 text-green-500 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <AlertDescription className="text-sm">
                            {previewResult.suggestion}
                          </AlertDescription>
                          {(previewResult.preview_violations.length > 0 || previewResult.preview_warnings.length > 0) && (
                            <div className="mt-2 space-y-1">
                              {previewResult.preview_violations.map((violation, index) => (
                                <div key={index} className="text-xs text-red-600">
                                  • {violation.description}
                                </div>
                              ))}
                              {previewResult.preview_warnings.map((warning, index) => (
                                <div key={index} className="text-xs text-yellow-600">
                                  • {warning.description}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {isPreviewAnalyzing && (
                          <div className="animate-spin">
                            <Clock className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </Alert>
                  )}
                  
                  <Textarea
                    value={message}
                    onChange={(e) => handleRealtimeAnalysis(e.target.value)}
                    placeholder="メッセージを入力してください..."
                    className="min-h-[80px]"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      送信ボタンを押して送信 | Shift+Enter: 改行
                    </span>
                    <Button 
                      onClick={handleSendMessage}
                      disabled={!message.trim() || isAnalyzing}
                      className="flex items-center space-x-2"
                    >
                      
                      <span>送信</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* リアルタイム分析パネル */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>リアルタイム分析</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {realtimeAnalysis ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      {getRiskIcon(realtimeAnalysis.risk_level)}
                      <Badge variant={getRiskBadgeVariant(realtimeAnalysis.risk_level)}>
                        {realtimeAnalysis.risk_level}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        信頼度: {Math.round(realtimeAnalysis.confidence * 100)}%
                      </span>
                    </div>

                    {realtimeAnalysis.detected_issues.length > 0 && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>検出された問題:</strong>
                          <ul className="mt-1 text-sm">
                            {realtimeAnalysis.detected_issues.map((issue, index) => (
                              <li key={index}>• {issue}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}

                    {realtimeAnalysis.suggestions.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">提案:</h4>
                        <ul className="text-sm space-y-1">
                          {realtimeAnalysis.suggestions.map((suggestion, index) => (
                            <li key={index} className="text-blue-600">• {suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {realtimeAnalysis.flagged_content.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">フラグ対象:</h4>
                        <div className="flex flex-wrap gap-1">
                          {realtimeAnalysis.flagged_content.map((content, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {content}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-gray-500">
                      処理時間: {realtimeAnalysis.processing_time_ms}ms
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">
                    メッセージを入力するとリアルタイム分析が表示されます
                  </p>
                )}
              </CardContent>
            </Card>

            {/* デモ用サンプルメッセージ */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm">デモ用サンプル</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setMessage("お疲れ様です。新商品の売上データをお送りします。")}
                  >
                    機密情報サンプル
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setMessage("このプロジェクトは本当にうざいです。")}
                  >
                    ハラスメントサンプル
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setMessage("いつもお世話になっております。資料の確認をお願いします。")}
                  >
                    適切なメッセージ
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
