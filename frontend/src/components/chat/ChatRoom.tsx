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
  compliance_notes?: string;
  detailed_analysis?: {
    sentiment?: string;
    emotion?: string;
    communication_style?: string;
    risk_indicators?: Array<{
      type: string;
      description: string;
      severity: string;
    }>;
    policy_details?: {
      violation_type?: string;
      severity?: string;
      keywords_detected?: string[];
    };
  };
}

export function ChatRoom({ room, onBack }: ChatRoomProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPreviewAnalyzing, setIsPreviewAnalyzing] = useState(false);
  const [realtimeAnalysis, setRealtimeAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
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
      setAnalysisError(null);
      return;
    }

    setIsPreviewAnalyzing(true);
    setAnalysisError(null);

    try {
      const idToken = await user.getIdToken();
      
      // Next.js APIを使用してプレビュー分析
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
        const result = await response.json();
        
        // 構造化されたレスポンスをAnalysisResult形式に変換
        const realtimeResult: AnalysisResult = {
          risk_level: result.risk_level || 'SAFE',
          confidence: result.confidence || 0.85,
          detected_issues: result.detected_issues || [],
          suggestions: result.suggestions || [],
          flagged_content: result.flagged_content || [],
          processing_time_ms: result.processing_time_ms || 100,
          compliance_notes: result.compliance_notes,
          detailed_analysis: result.detailed_analysis || {}
        };
        
        setRealtimeAnalysis(realtimeResult);
      } else {
        setAnalysisError(`分析に失敗しました: ${response.status}`);
        setRealtimeAnalysis(null);
      }
    } catch (error) {
      console.error('Preview analysis failed:', error);
      setAnalysisError('ネットワークエラーが発生しました');
      setRealtimeAnalysis(null);
    } finally {
      setIsPreviewAnalyzing(false);
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
            {(isPreviewAnalyzing || realtimeAnalysis || analysisError) && (
              <div className="p-4 border-b bg-gradient-to-r from-gray-50 to-blue-50">
                {/* ローディング状態 */}
                {isPreviewAnalyzing && (
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-gray-600">分析中...</span>
                  </div>
                )}

                {/* エラー表示 */}
                {analysisError && (
                  <Alert className="mb-3" variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{analysisError}</AlertDescription>
                  </Alert>
                )}

                {/* 分析結果 */}
                {realtimeAnalysis && !isPreviewAnalyzing && (
                  <>
                    {/* 基本情報 */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {getRiskIcon(realtimeAnalysis.risk_level)}
                        <Badge variant={getRiskBadgeVariant(realtimeAnalysis.risk_level)} className="font-medium">
                          {realtimeAnalysis.risk_level}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          信頼度: {Math.round(realtimeAnalysis.confidence * 100)}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {realtimeAnalysis.processing_time_ms}ms
                      </div>
                    </div>

                    {/* 詳細分析情報 */}
                    {realtimeAnalysis.detailed_analysis && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        {realtimeAnalysis.detailed_analysis.sentiment && (
                          <div className="bg-white p-2 rounded-lg border">
                            <div className="text-xs font-medium text-gray-500 mb-1">感情</div>
                            <div className="text-sm capitalize">
                              {realtimeAnalysis.detailed_analysis.sentiment === 'positive' ? '😊 ポジティブ' :
                               realtimeAnalysis.detailed_analysis.sentiment === 'negative' ? '😟 ネガティブ' : '😐 中性'}
                            </div>
                          </div>
                        )}
                        
                        {realtimeAnalysis.detailed_analysis.emotion && (
                          <div className="bg-white p-2 rounded-lg border">
                            <div className="text-xs font-medium text-gray-500 mb-1">感情表現</div>
                            <div className="text-sm capitalize">
                              {realtimeAnalysis.detailed_analysis.emotion === 'joy' ? '😄 喜び' :
                               realtimeAnalysis.detailed_analysis.emotion === 'anger' ? '😡 怒り' :
                               realtimeAnalysis.detailed_analysis.emotion === 'sadness' ? '😢 悲しみ' :
                               realtimeAnalysis.detailed_analysis.emotion === 'fear' ? '😨 恐れ' :
                               realtimeAnalysis.detailed_analysis.emotion === 'surprise' ? '😲 驚き' :
                               realtimeAnalysis.detailed_analysis.emotion === 'disgust' ? '🤢 嫌悪' : '😐 中性'}
                            </div>
                          </div>
                        )}
                        
                        {realtimeAnalysis.detailed_analysis.communication_style && (
                          <div className="bg-white p-2 rounded-lg border">
                            <div className="text-xs font-medium text-gray-500 mb-1">コミュニケーションスタイル</div>
                            <div className="text-sm capitalize">
                              {realtimeAnalysis.detailed_analysis.communication_style === 'formal' ? '🎩 フォーマル' :
                               realtimeAnalysis.detailed_analysis.communication_style === 'informal' ? '😊 カジュアル' :
                               realtimeAnalysis.detailed_analysis.communication_style === 'aggressive' ? '⚡ 攻撃的' :
                               realtimeAnalysis.detailed_analysis.communication_style === 'friendly' ? '🤝 フレンドリー' : '😐 普通'}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 検出された問題 */}
                    {realtimeAnalysis.detected_issues.length > 0 && (
                      <Alert className="mb-3">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong className="text-red-600">検出された問題:</strong>
                          <ul className="mt-2 space-y-1">
                            {realtimeAnalysis.detected_issues.map((issue, index) => (
                              <li key={index} className="flex items-start">
                                <span className="text-red-500 mr-2">•</span>
                                <span className="text-sm">{issue}</span>
                              </li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* リスク指標 */}
                    {realtimeAnalysis.detailed_analysis?.risk_indicators && 
                     realtimeAnalysis.detailed_analysis.risk_indicators.length > 0 && (
                      <div className="mb-3">
                        <h4 className="font-semibold text-sm mb-2 text-orange-600">⚠️ リスク指標:</h4>
                        <div className="space-y-1">
                          {realtimeAnalysis.detailed_analysis.risk_indicators.map((risk, index) => (
                            <div key={index} className="bg-orange-50 border border-orange-200 rounded p-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{risk.type}</span>
                                <Badge variant={risk.severity === 'high' ? 'destructive' : 
                                              risk.severity === 'medium' ? 'default' : 'secondary'} 
                                       className="text-xs">
                                  {risk.severity}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{risk.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 提案 */}
                    {realtimeAnalysis.suggestions.length > 0 && (
                      <div className="mb-3">
                        <h4 className="font-semibold text-sm mb-2 text-blue-600">💡 改善提案:</h4>
                        <div className="space-y-2">
                          {realtimeAnalysis.suggestions.map((suggestion, index) => (
                            <div key={index} className="bg-blue-50 border border-blue-200 rounded p-2">
                              <span className="text-sm text-blue-800">{suggestion}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* フラグ対象キーワード */}
                    {realtimeAnalysis.flagged_content.length > 0 && (
                      <div className="mb-3">
                        <h4 className="font-semibold text-sm mb-2 text-purple-600">🚩 フラグ対象キーワード:</h4>
                        <div className="flex flex-wrap gap-1">
                          {realtimeAnalysis.flagged_content.map((content, index) => (
                            <Badge key={index} variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-300">
                              {content}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* コンプライアンス注記 */}
                    {realtimeAnalysis.compliance_notes && (
                      <div className="mt-3 p-3 bg-gray-100 rounded-lg">
                        <h4 className="font-semibold text-sm mb-1 text-gray-700">📋 詳細分析:</h4>
                        <p className="text-sm text-gray-600">{realtimeAnalysis.compliance_notes}</p>
                      </div>
                    )}
                  </>
                )}
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
