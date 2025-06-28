'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/UserSelect';
import { ChatRoomList } from '@/components/chat/ChatRoomList';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { ChatRoom as ChatRoomType } from '@/lib/firebase';

export default function Home() {
  const { user, loading } = useAuth();
  const [selectedRoom, setSelectedRoom] = useState<ChatRoomType | null>(null);

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

  if (selectedRoom) {
    return (
      <ChatRoom 
        room={selectedRoom} 
        onBack={() => setSelectedRoom(null)} 
      />
    );
  }

  return (
    <ChatRoomList 
      onRoomSelect={setSelectedRoom} 
    />
  );
}
