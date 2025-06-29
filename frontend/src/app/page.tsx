'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/UserSelect';
import { SlackLayout } from '@/components/layout/SlackLayout';
import { ChatRoom } from '@/components/chat/ChatRoom';
import AudioAnalysis from '@/components/audio/AudioAnalysis';
import ChatAnalysisReport from '@/components/chat/ChatAnalysisReport';
import { 
  ChatRoom as ChatRoomType, 
  ChatMessage,
  listenToChatRooms, 
  createChatRoom,
  listenToMessages
} from '@/lib/firebase';

export default function Home() {
  const { user, loading } = useAuth();
  const [selectedRoom, setSelectedRoom] = useState<ChatRoomType | null>(null);
  const [chatRooms, setChatRooms] = useState<ChatRoomType[]>([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [isAudioMode, setIsAudioMode] = useState(false);
  
  // チャット分析関連の状態
  const [isAnalysisMode, setIsAnalysisMode] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // チャットルーム一覧をリアルタイムで取得
  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = listenToChatRooms(user.uid, (newRooms) => {
      setChatRooms(newRooms);
    });

    return () => unsubscribe();
  }, [user]);

  // 選択されたルームのメッセージをリアルタイムで取得
  useEffect(() => {
    if (!selectedRoom?.id) {
      setMessages([]);
      setMessageCount(0);
      return;
    }
    
    const unsubscribe = listenToMessages(selectedRoom.id, (newMessages) => {
      setMessages(newMessages);
      setMessageCount(newMessages.length);
    });

    return () => unsubscribe();
  }, [selectedRoom?.id]);

  const handleCreateRoom = async () => {
    setShowCreateRoom(true);
  };

  const handleAudioModeSelect = () => {
    setSelectedRoom(null);
    setIsAudioMode(true);
    setShowReport(false);
  };

  const handleRoomSelect = (room: ChatRoomType | null) => {
    setSelectedRoom(room);
    setIsAudioMode(false);
    setShowReport(false);
  };

  const handleAnalysisModeToggle = () => {
    setIsAnalysisMode(!isAnalysisMode);
  };

  const handleShowReport = () => {
    setShowReport(true);
  };

  const handleCreateRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    setCreating(true);
    try {
      await createChatRoom(newRoomName, newRoomDescription);
      setNewRoomName('');
      setNewRoomDescription('');
      setShowCreateRoom(false);
    } catch (error) {
      console.error('Failed to create room:', error);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">システムを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  // レポート画面を表示する場合
  if (showReport && selectedRoom) {
    const chatMessages = messages.map(msg => ({
      user: msg.senderName || 'Unknown',
      content: msg.content,
      timestamp: msg.timestamp.toDate().toISOString()
    }));
    
    return (
      <ChatAnalysisReport 
        onBack={() => setShowReport(false)}
        chatMessages={chatMessages}
      />
    );
  }

  return (
    <>
      <SlackLayout
        selectedRoom={selectedRoom}
        onRoomSelect={handleRoomSelect}
        chatRooms={chatRooms}
        onCreateRoom={handleCreateRoom}
        onAudioModeSelect={handleAudioModeSelect}
        isAudioMode={isAudioMode}
        isAnalysisMode={isAnalysisMode}
        onAnalysisModeToggle={handleAnalysisModeToggle}
        onShowReport={handleShowReport}
        messageCount={messageCount}
      >
        {isAudioMode ? (
          <AudioAnalysis />
        ) : (
          selectedRoom && <ChatRoom room={selectedRoom} isAnalysisMode={isAnalysisMode} />
        )}
      </SlackLayout>

      {/* チャットルーム作成モーダル */}
      {showCreateRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowCreateRoom(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-semibold mb-4">新しいチャットルームを作成</h2>
            <form onSubmit={handleCreateRoomSubmit}>
              <div className="mb-4">
                <label htmlFor="roomName" className="block text-sm font-medium text-gray-700 mb-1">
                  ルーム名 *
                </label>
                <input
                  type="text"
                  id="roomName"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="例: 一般"
                  required
                  autoFocus
                />
              </div>
              <div className="mb-6">
                <label htmlFor="roomDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  説明
                </label>
                <textarea
                  id="roomDescription"
                  value={newRoomDescription}
                  onChange={(e) => setNewRoomDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="このチャットルームの目的や説明"
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateRoom(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  disabled={creating}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={creating || !newRoomName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? '作成中...' : '作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
