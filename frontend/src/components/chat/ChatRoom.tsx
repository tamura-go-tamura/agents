'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { Send, AlertTriangle, Shield, Clock, ArrowLeft } from 'lucide-react';
import { 
  ChatMessage, 
  ChatRoom as ChatRoomType, 
  sendMessage, 
  listenToMessages, 
  updateMessageAnalysis 
} from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';

interface ChatRoomProps {
  room: ChatRoomType;
  onBack: () => void;
}

interface AnalysisResult {
  risk_level: 'SAFE' | 'WARNING' | 'DANGER';
  confidence: number;
  detected_issues: string[];
  suggestions: string[];
  flagged_content: string[];
  processing_time_ms: number;
}

export function ChatRoom({ room, onBack }: ChatRoomProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [realtimeAnalysis, setRealtimeAnalysis] = useState<AnalysisResult | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const connectWebSocket = React.useCallback(() => {
    if (!user) return;
    
    // 既に接続中の場合は何もしない
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket connection already in progress');
      return;
    }
    
    // 既存の接続があれば閉じる
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
    }
    
    try {
      console.log('Attempting WebSocket connection to ws://localhost:8080/ws/realtime-analysis');
      wsRef.current = new WebSocket('ws://localhost:8080/ws/realtime-analysis');
      
      wsRef.current.onopen = (event) => {
        console.log('WebSocket connected for real-time analysis', event);
        setWsConnected(true);
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
          url: wsRef.current?.url
        });
        setWsConnected(false);
      };
      
      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        setWsConnected(false);
        
        // Only retry if not a normal close
        if (event.code !== 1000 && user) {
          console.log('Retrying WebSocket connection in 3 seconds...');
          setTimeout(() => {
            if (user) { // Check user is still available
              connectWebSocket();
            }
          }, 3000);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setWsConnected(false);
      // Retry after error
      setTimeout(() => {
        if (user) {
          connectWebSocket();
        }
      }, 3000);
    }
  }, [user]);

  useEffect(() => {
    if (!room.id) return;
    
    // Listen to messages in real-time
    const unsubscribe = listenToMessages(room.id, (newMessages) => {
      setMessages(newMessages);
    });

    // Connect WebSocket for real-time analysis with a small delay
    const connectTimer = setTimeout(() => {
      connectWebSocket();
    }, 100);
    
    return () => {
      unsubscribe();
      clearTimeout(connectTimer);
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [room.id, connectWebSocket]);

  const handleSendMessage = async () => {
    if (!message.trim() || !user || !room.id) return;

    setIsAnalyzing(true);
    
    try {
      // Send message to Firestore
      const messageId = await sendMessage(room.id, message);
      
      // Send to Next.js API Route for analysis
      const response = await fetch('/api/analyze-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({
          message: message,
          user_id: user.uid,
          room_id: room.id,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        const analysis: AnalysisResult = await response.json();
        
        // Update message with analysis result
        await updateMessageAnalysis(messageId, analysis);
      } else {
        console.error('Analysis failed:', response.status, await response.text());
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }

    setMessage('');
    setIsAnalyzing(false);
  };

  const handleRealtimeAnalysis = (value: string) => {
    setMessage(value);
    
    if (value.trim() && wsRef.current?.readyState === WebSocket.OPEN && user) {
      wsRef.current.send(JSON.stringify({
        message: value,
        user_id: user.uid,
        room_id: room.id,
        timestamp: new Date().toISOString()
      }));
    } else {
      setRealtimeAnalysis(null);
    }
  };

//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   };

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

  const formatTimestamp = (timestamp: unknown) => {
    if (!timestamp) return '';
    
    const date = timestamp && typeof timestamp === 'object' && 'toDate' in timestamp 
      ? (timestamp as Timestamp).toDate() 
      : new Date(timestamp as string);
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user) return null;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center space-x-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{room.name}</h1>
          {room.description && (
            <p className="text-sm text-gray-500">{room.description}</p>
          )}
        </div>
        <Badge variant="outline">
          {room.participants.length} 参加者
        </Badge>
      </div>

      <div className="flex-1 flex">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  msg.senderId === user.uid 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white border'
                }`}>
                  {msg.senderId !== user.uid && (
                    <p className="text-xs opacity-75 mb-1">{msg.senderName}</p>
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
                    {formatTimestamp(msg.timestamp)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-4 bg-white border-t">
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
          </div>
        </div>

        {/* Real-time Analysis Panel */}
        <div className="w-80 border-l bg-white">
          <Card className="h-full rounded-none border-0">
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

              {/* Demo Sample Messages */}
              <div className="mt-6">
                <h4 className="font-semibold text-sm mb-3">デモ用サンプル</h4>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setMessage("お疲れ様です。新商品の売上データをお送りします。売上は3000万円です。")}
                  >
                    機密情報サンプル
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setMessage("このプロジェクトは本当にうざいです。やる気が出ません。")}
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
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
