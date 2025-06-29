'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle, Users, Plus, LogOut } from 'lucide-react';
import { 
  ChatRoom as ChatRoomType, 
  listenToChatRooms, 
  createChatRoom,
  logout
} from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';

interface ChatRoomListProps {
  onRoomSelect: (room: ChatRoomType) => void;
}

export function ChatRoomList({ onRoomSelect }: ChatRoomListProps) {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoomType[]>([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = listenToChatRooms(user.uid, (newRooms) => {
      setRooms(newRooms);
    });

    return () => unsubscribe();
  }, [user]);

  const handleCreateRoom = async (e: React.FormEvent) => {
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

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const formatTimestamp = (timestamp: unknown) => {
    if (!timestamp) return '';
    
    const date = timestamp && typeof timestamp === 'object' && 'toDate' in timestamp 
      ? (timestamp as Timestamp).toDate() 
      : new Date(timestamp as string);
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else if (days === 1) {
      return '昨日';
    } else if (days < 7) {
      return `${days}日前`;
    } else {
      return date.toLocaleDateString('ja-JP');
    }
  };

  if (!user) return null;

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">チョットマッタ AI</h1>
            <p className="text-sm text-gray-500">コミュニケーションガードレールシステム</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-sm">
                  {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{user.displayName || user.email}</p>
                <p className="text-xs text-gray-500">オンライン</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Room List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          {/* Create Room Button */}
          <Card className="border-dashed">
            <CardContent className="p-4">
              {!showCreateRoom ? (
                <Button
                  onClick={() => setShowCreateRoom(true)}
                  variant="ghost"
                  className="w-full flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>新しいチャットルームを作成</span>
                </Button>
              ) : (
                <form onSubmit={handleCreateRoom} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">ルーム名</label>
                    <input
                      type="text"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="例: 開発チーム"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">説明（任意）</label>
                    <input
                      type="text"
                      value={newRoomDescription}
                      onChange={(e) => setNewRoomDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="例: 開発プロジェクトの進捗確認用"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button type="submit" disabled={creating} size="sm">
                      作成
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowCreateRoom(false);
                        setNewRoomName('');
                        setNewRoomDescription('');
                      }}
                    >
                      キャンセル
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Room Cards */}
          {rooms.map((room) => (
            <Card key={room.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4" onClick={() => onRoomSelect(room)}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <MessageCircle className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{room.name}</h3>
                      {room.description && (
                        <p className="text-sm text-gray-500">{room.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="flex items-center space-x-1">
                      <Users className="h-3 w-3" />
                      <span>{room.participants.length}</span>
                    </Badge>
                  </div>
                </div>
                
                {room.lastMessage && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-600">
                          {room.lastMessage.senderName}
                        </p>
                        <p className="text-sm text-gray-800 truncate">
                          {room.lastMessage.content}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500 ml-2">
                        {formatTimestamp(room.lastMessage.timestamp)}
                      </span>
                    </div>
                  </div>
                )}
                
                {!room.lastMessage && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 italic">
                      まだメッセージがありません
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {rooms.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">
                  チャットルームがありません
                </h3>
                <p className="text-gray-500 mb-4">
                  新しいチャットルームを作成して、チョットマッタ AI のガードレール機能を体験してください。
                </p>
                <Button onClick={() => setShowCreateRoom(true)}>
                  最初のルームを作成
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Demo Info */}
      <div className="p-4 bg-blue-50 border-t">
        <div className="text-center">
          <h4 className="font-semibold text-blue-900 text-sm mb-1">
            Google Cloud Hackathon 2024 デモ
          </h4>
          <p className="text-xs text-blue-800">
            リアルタイム AI 通信監視システム
          </p>
        </div>
      </div>
    </div>
  );
}
