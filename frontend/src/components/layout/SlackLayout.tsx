'use client';

import React from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { ChatRoom as ChatRoomType } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Plus, Hash, Users, Settings, MessageSquare, Mic, FileText } from 'lucide-react';

interface SlackLayoutProps {
  children: React.ReactNode;
  selectedRoom: ChatRoomType | null;
  onRoomSelect: (room: ChatRoomType | null) => void;
  chatRooms: ChatRoomType[];
  onCreateRoom: () => void;
  onAudioModeSelect: () => void;
  isAudioMode?: boolean;
  // チャット関連の追加プロパティ
  isAnalysisMode?: boolean;
  onAnalysisModeToggle?: () => void;
  onShowReport?: () => void;
  messageCount?: number;
}

export function SlackLayout({ 
  children, 
  selectedRoom, 
  onRoomSelect, 
  chatRooms,
  onCreateRoom,
  onAudioModeSelect,
  isAudioMode = false,
  isAnalysisMode = false,
  onAnalysisModeToggle,
  onShowReport,
  messageCount = 0
}: SlackLayoutProps) {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 左サイドバー */}
      <div className="w-64 bg-gray-900 text-white flex flex-col">
        {/* ヘッダー */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Image src="/logo.png" alt="SafeComm AI" width={32} height={32} className="h-8 w-8" />
              <h1 className="text-xl font-bold">SafeComm AI</h1>
            </div>
            <Settings className="h-5 w-5 text-gray-400 cursor-pointer hover:text-white" />
          </div>
          <div className="text-sm text-gray-400 mt-1">
            {user?.email || user?.displayName}
          </div>
        </div>

        {/* チャットルームセクション */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                チャットルーム
              </h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={onCreateRoom}
                className="text-gray-400 hover:text-white hover:bg-gray-700 p-1 h-6 w-6"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {/* チャットルーム一覧 */}
            <div className="space-y-1">
              {chatRooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => onRoomSelect(room)}
                  className={`flex items-center px-3 py-2 rounded-md cursor-pointer group ${
                    selectedRoom?.id === room.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <Hash className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate text-sm">{room.name}</span>
                </div>
              ))}
            </div>

            {/* 音声分析セクション */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                  音声分析
                </h2>
              </div>
              
              <div className="space-y-1">
                <div
                  onClick={onAudioModeSelect}
                  className={`flex items-center px-3 py-2 rounded-md cursor-pointer group ${
                    isAudioMode
                      ? 'bg-green-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <Mic className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate text-sm">リアルタイム分析</span>
                </div>
              </div>
            </div>

            {/* ダイレクトメッセージセクション */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                  ダイレクトメッセージ
                </h2>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-400 hover:text-white hover:bg-gray-700 p-1 h-6 w-6"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {/* DM一覧（将来の機能） */}
              <div className="space-y-1">
                <div className="flex items-center px-3 py-2 rounded-md text-gray-500 text-sm">
                  <Users className="h-4 w-4 mr-2" />
                  まだダイレクトメッセージはありません
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="ml-2">
                <div className="text-sm font-medium truncate max-w-32">
                  {user?.displayName || user?.email?.split('@')[0]}
                </div>
                <div className="text-xs text-gray-400">オンライン</div>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={logout}
              className="text-gray-400 hover:text-white hover:bg-gray-700"
            >
              ログアウト
            </Button>
          </div>
        </div>
      </div>

      {/* メインコンテンツエリア */}
      <div className="flex-1 flex flex-col">
        {isAudioMode ? (
          <>
            {/* 音声分析ヘッダー */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center">
                <Mic className="h-5 w-5 text-blue-600 mr-2" />
                <h1 className="text-xl font-semibold text-gray-900">リアルタイム音声分析</h1>
                <div className="ml-4 text-sm text-gray-500">
                  AI による音声監視システム
                </div>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                コンプライアンス違反をリアルタイムで検知・警告します
              </div>
            </div>
            
            {/* 音声分析コンテンツ */}
            <div className="flex-1 overflow-hidden">
              {children}
            </div>
          </>
        ) : selectedRoom ? (
          <>
            {/* チャットヘッダー */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Hash className="h-5 w-5 text-gray-500 mr-2" />
                  <h1 className="text-xl font-semibold text-gray-900">{selectedRoom.name}</h1>
                  <div className="ml-4 text-sm text-gray-500">
                    {messageCount > 0 ? `${messageCount}件のメッセージ` : 'メンバー'}
                  </div>
                </div>
                
                {/* 分析コントロール */}
                <div className="flex items-center space-x-4">
                  {/* 分析モードトグル */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">検知モード</span>
                    <button
                      onClick={onAnalysisModeToggle}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        isAnalysisMode ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                      type="button"
                      role="switch"
                      aria-checked={isAnalysisMode}
                      title={isAnalysisMode ? '検知モードON' : '検知モードOFF'}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                          isAnalysisMode ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  
                  {/* レポートボタン */}
                  <Button
                    onClick={onShowReport}
                    variant="outline"
                    size="sm"
                    className="border-blue-600 text-blue-600 hover:bg-blue-50"
                    disabled={messageCount === 0}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    分析レポート
                  </Button>
                </div>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {selectedRoom.description || 'チャットルームの説明はありません'}
              </div>
            </div>
            
            {/* チャットコンテンツ */}
            <div className="flex-1 overflow-hidden">
              {children}
            </div>
          </>
        ) : (
          /* ルーム未選択時の表示 */
          <div className="flex-1 flex items-center justify-center bg-white">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                SafeComm AIへようこそ
              </h2>
              <p className="text-gray-600 mb-6 max-w-md">
                左側のサイドバーからチャットルームや音声分析モードを選択してください。
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={onCreateRoom} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  チャットルームを作成
                </Button>
                <Button onClick={onAudioModeSelect} variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
                  <Mic className="h-4 w-4 mr-2" />
                  音声分析を開始
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
