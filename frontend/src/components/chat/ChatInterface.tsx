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
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // WebSocket接続関数を定義
    const connectWebSocket = () => {
      try {
        wsRef.current = new WebSocket('ws://localhost:8080/ws/realtime-analysis');
        
        wsRef.current.onopen = () => {
          console.log('WebSocket connected');
        };
        
        wsRef.current.onmessage = (event) => {
          const analysis: AnalysisResult = JSON.parse(event.data);
          setRealtimeAnalysis(analysis);
        };
        
        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
        
        wsRef.current.onclose = () => {
          console.log('WebSocket disconnected');
          // 再接続試行
          setTimeout(connectWebSocket, 3000);
        };
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
      }
    };

    // WebSocket接続
    connectWebSocket();
    
    // デモ用初期メッセージ
    addSystemMessage("SafeComm AI 通信監視システムが開始されました。メッセージを入力してリアルタイム分析を体験してください。");
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
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
      // バックエンドAPIでメッセージ分析
      const response = await fetch('http://localhost:8080/api/analyze-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('safecomm_demo_token')}`
        },
        body: JSON.stringify({
          message: message,
          user_id: user.email || "",
          department: user.department,
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
    
    if (value.trim() && wsRef.current?.readyState === WebSocket.OPEN && user) {
      // リアルタイム分析要求
      wsRef.current.send(JSON.stringify({
        message: value,
        user_id: user.id,
        department: user.department,
        timestamp: new Date().toISOString()
      }));
    } else {
      setRealtimeAnalysis(null);
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
                  {user.avatar || user.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-gray-500">{user.department}</p>
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
                    <div key={msg.id} className={`flex ${msg.user_id === 'system' ? 'justify-center' : msg.user_id === user.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        msg.user_id === 'system' 
                          ? 'bg-blue-100 text-blue-800 text-sm'
                          : msg.user_id === user.id 
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
                  <Textarea
                    value={message}
                    onChange={(e) => handleRealtimeAnalysis(e.target.value)}
                    placeholder="メッセージを入力してください..."
                    className="min-h-[80px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      Enter: 送信 | Shift+Enter: 改行
                    </span>
                    <Button 
                      onClick={handleSendMessage}
                      disabled={!message.trim() || isAnalyzing}
                      className="flex items-center space-x-2"
                    >
                      <Send className="h-4 w-4" />
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
