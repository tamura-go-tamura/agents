'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { Send, AlertTriangle, Shield, ArrowLeft } from 'lucide-react';
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

export function ChatRoom({ room, onBack }: ChatRoomProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [realtimeAnalysis, setRealtimeAnalysis] = useState<AnalysisResult | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      };
      
      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        
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
    
    // 前のタイマーをクリア
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    
    if (value.trim()) {
      // 500ms後にプレビュー分析を実行（デバウンス）
      previewTimeoutRef.current = setTimeout(() => {
        performPreviewAnalysis(value);
      }, 500);
    } else {
      setRealtimeAnalysis(null);
    }
  };

  const performPreviewAnalysis = async (messageText: string) => {
    if (!messageText.trim() || !user) {
      setRealtimeAnalysis(null);
      return;
    }

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
          user_id: user.email || user.uid,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        const result: PreviewResult = await response.json();
        
        // PreviewResultをAnalysisResult形式に変換
        const analysisResult: AnalysisResult = {
          risk_level: result.has_violations ? 'DANGER' : result.has_warnings ? 'WARNING' : 'SAFE',
          confidence: 0.85, // デフォルト値
          detected_issues: [
            ...result.preview_violations.map(v => v.description),
            ...result.preview_warnings.map(w => w.description)
          ],
          suggestions: [result.suggestion],
          flagged_content: result.preview_violations.map(v => v.violation_type),
          processing_time_ms: 100 // デフォルト値
        };
        
        setRealtimeAnalysis(analysisResult);
      } else {
        setRealtimeAnalysis(null);
      }
    } catch (error) {
      console.error('Preview analysis failed:', error);
      setRealtimeAnalysis(null);
    }
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

      <div className="flex-1 flex min-h-0">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages - スクロール可能エリア */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
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

          {/* Message Input - 画面下部固定 */}
          <div className="flex-shrink-0 bg-white border-t">
            {/* リアルタイム分析表示 */}
            {realtimeAnalysis && (
              <div className="p-4 border-b bg-gray-50">
                <div className="flex items-center space-x-2 mb-2">
                  {getRiskIcon(realtimeAnalysis.risk_level)}
                  <Badge variant={getRiskBadgeVariant(realtimeAnalysis.risk_level)}>
                    {realtimeAnalysis.risk_level}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    信頼度: {Math.round(realtimeAnalysis.confidence * 100)}%
                  </span>
                </div>

                {realtimeAnalysis.detected_issues.length > 0 && (
                  <Alert className="mb-2">
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
                  <div className="mb-2">
                    <h4 className="font-semibold text-sm mb-1">提案:</h4>
                    <ul className="text-sm space-y-1">
                      {realtimeAnalysis.suggestions.map((suggestion, index) => (
                        <li key={index} className="text-blue-600">• {suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {realtimeAnalysis.flagged_content.length > 0 && (
                  <div className="mb-2">
                    <h4 className="font-semibold text-sm mb-1">フラグ対象:</h4>
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
            )}
            
            <div className="p-4">
              <div className="space-y-2">
                <Textarea
                  value={message}
                  onChange={(e) => handleRealtimeAnalysis(e.target.value)}
                  placeholder="メッセージを入力してください..."
                  className="min-h-[80px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
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
        </div>
      </div>
    </div>
  );
}
