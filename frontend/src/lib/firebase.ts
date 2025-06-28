/**
 * Firebase configuration for SafeComm AI Demo
 * Google Cloud Hackathon 2024
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, serverTimestamp, doc, setDoc, getDoc, where, limit, Timestamp, QuerySnapshot } from 'firebase/firestore';

// Firebase configuration (デモ用設定)
const firebaseConfig = {
  // デモ用設定 - 実際のプロジェクトでは環境変数を使用
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "safecomm-demo.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "safecomm-demo",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "safecomm-demo.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abcdef123456"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Google Auth provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Types
export interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  timestamp: Timestamp;
  roomId: string;
  analysis?: {
    risk_level: 'SAFE' | 'WARNING' | 'DANGER';
    confidence: number;
    detected_issues: string[];
    suggestions: string[];
    flagged_content: string[];
    processing_time_ms: number;
  };
}

export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  participants: string[];
  createdBy: string;
  createdAt: Timestamp;
  lastMessage?: {
    content: string;
    senderName: string;
    timestamp: Timestamp;
  };
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role?: string;
  photoURL?: string;
  createdAt: Timestamp;
  lastActive: Timestamp;
}

// Auth functions
export const loginWithGoogle = async (): Promise<User> => {
  try {
    if (!googleProvider) {
      throw new Error('Google Auth Provider not initialized');
    }
    
    const result = await signInWithPopup(auth, googleProvider);
    
    if (!result.user) {
      throw new Error('No user returned from Google authentication');
    }
    
    // Create or update user profile
    await createOrUpdateUserProfile(result.user);
    
    return result.user;
  } catch (error) {
    console.error('Google login failed:', error);
    throw error;
  }
};

export const loginWithEmail = async (email: string, password: string): Promise<User> => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await updateUserActivity(result.user.uid);
    return result.user;
  } catch (error) {
    console.error('Email login failed:', error);
    throw error;
  }
};

export const registerWithEmail = async (email: string, password: string, displayName: string): Promise<User> => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    
    // Create user profile
    await createOrUpdateUserProfile(result.user, { displayName });
    
    return result.user;
  } catch (error) {
    console.error('Email registration failed:', error);
    throw error;
  }
};

export const logout = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout failed:', error);
    throw error;
  }
};

// User profile functions
export const createOrUpdateUserProfile = async (user: User, additionalData?: { displayName?: string; role?: string }): Promise<void> => {
  const userRef = doc(db, 'users', user.uid);
  
  const userData: Partial<UserProfile> = {
    uid: user.uid,
    email: user.email || '',
    displayName: additionalData?.displayName || user.displayName || user.email?.split('@')[0] || '',
    photoURL: user.photoURL || undefined,
    lastActive: serverTimestamp() as Timestamp,
    ...additionalData
  };

  try {
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      // New user
      await setDoc(userRef, {
        ...userData,
        createdAt: serverTimestamp(),
      });
    } else {
      // Update existing user
      await setDoc(userRef, userData, { merge: true });
    }
  } catch (error) {
    console.error('Failed to create/update user profile:', error);
    throw error;
  }
};

export const updateUserActivity = async (uid: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      lastActive: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Failed to update user activity:', error);
  }
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Failed to get user profile:', error);
    return null;
  }
};

// Chat room functions
export const createChatRoom = async (name: string, description?: string): Promise<string> => {
  if (!auth.currentUser) throw new Error('User not authenticated');

  try {
    const roomData: Omit<ChatRoom, 'id'> = {
      name,
      description,
      participants: [auth.currentUser.uid],
      createdBy: auth.currentUser.uid,
      createdAt: serverTimestamp() as Timestamp,
    };

    const docRef = await addDoc(collection(db, 'chatRooms'), roomData);
    return docRef.id;
  } catch (error) {
    console.error('Failed to create chat room:', error);
    throw error;
  }
};

export const joinChatRoom = async (roomId: string): Promise<void> => {
  if (!auth.currentUser) throw new Error('User not authenticated');

  try {
    const roomRef = doc(db, 'chatRooms', roomId);
    const roomDoc = await getDoc(roomRef);
    
    if (roomDoc.exists()) {
      const roomData = roomDoc.data() as ChatRoom;
      if (!roomData.participants.includes(auth.currentUser.uid)) {
        await setDoc(roomRef, {
          participants: [...roomData.participants, auth.currentUser.uid]
        }, { merge: true });
      }
    }
  } catch (error) {
    console.error('Failed to join chat room:', error);
    throw error;
  }
};

// Chat message functions
export const sendMessage = async (roomId: string, content: string): Promise<string> => {
  if (!auth.currentUser) throw new Error('User not authenticated');

  try {
    const userProfile = await getUserProfile(auth.currentUser.uid);
    
    const messageData: Omit<ChatMessage, 'id'> = {
      content,
      senderId: auth.currentUser.uid,
      senderName: userProfile?.displayName || auth.currentUser.displayName || 'Unknown User',
      senderEmail: auth.currentUser.email || '',
      timestamp: serverTimestamp() as Timestamp,
      roomId,
    };

    const docRef = await addDoc(collection(db, 'messages'), messageData);
    
    // Update room's last message
    const roomRef = doc(db, 'chatRooms', roomId);
    await setDoc(roomRef, {
      lastMessage: {
        content: content.length > 50 ? content.substring(0, 50) + '...' : content,
        senderName: messageData.senderName,
        timestamp: serverTimestamp()
      }
    }, { merge: true });

    return docRef.id;
  } catch (error) {
    console.error('Failed to send message:', error);
    throw error;
  }
};

export const updateMessageAnalysis = async (messageId: string, analysis: ChatMessage['analysis']): Promise<void> => {
  try {
    const messageRef = doc(db, 'messages', messageId);
    await setDoc(messageRef, {
      analysis
    }, { merge: true });
  } catch (error) {
    console.error('Failed to update message analysis:', error);
    throw error;
  }
};

// Real-time listeners
export const listenToMessages = (roomId: string, callback: (messages: ChatMessage[]) => void): (() => void) => {
  // Simplified query to avoid index requirements during development
  const messagesQuery = query(
    collection(db, 'messages'),
    where('roomId', '==', roomId),
    limit(100)
  );

  return onSnapshot(messagesQuery, (snapshot) => {
    const messages: ChatMessage[] = [];
    snapshot.forEach((doc) => {
      messages.push({
        id: doc.id,
        ...doc.data()
      } as ChatMessage);
    });
    
    // Sort on client side
    messages.sort((a, b) => {
      if (!a.timestamp || !b.timestamp) return 0;
      return a.timestamp.seconds - b.timestamp.seconds;
    });
    
    callback(messages);
  });
};

export const listenToChatRooms = (userId: string, callback: (rooms: ChatRoom[]) => void): (() => void) => {
  // Temporary fix: Remove orderBy to avoid index requirement
  // TODO: Create composite index for participants + createdAt
  const roomsQuery = query(
    collection(db, 'chatRooms'),
    where('participants', 'array-contains', userId)
  );

  return onSnapshot(roomsQuery, (snapshot) => {
    const rooms: ChatRoom[] = [];
    snapshot.forEach((doc) => {
      rooms.push({
        id: doc.id,
        ...doc.data()
      } as ChatRoom);
    });
    
    // Sort on client side instead
    rooms.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return b.createdAt.seconds - a.createdAt.seconds;
    });
    
    callback(rooms);
  });
};

// Auth state listener
export const onAuthStateChange = (callback: (user: User | null) => void): (() => void) => {
  return onAuthStateChanged(auth, callback);
};

// Demo data creation
export const createDemoRooms = async (): Promise<void> => {
  if (!auth.currentUser) return;

  try {
    // Check if user already has rooms
    const roomsQuery = query(
      collection(db, 'chatRooms'),
      where('participants', 'array-contains', auth.currentUser.uid),
      limit(1)
    );
    
    const snapshot = await new Promise<QuerySnapshot>((resolve) => {
      const unsubscribe = onSnapshot(roomsQuery, (snapshot) => {
        unsubscribe();
        resolve(snapshot);
      });
    });

    if (snapshot.empty) {
      // Create initial rooms for new users
      await createChatRoom('一般チャット', 'SafeComm AI デモ用一般チャットルーム');
      await createChatRoom('開発チーム', '開発プロジェクトの進捗確認用');
      await createChatRoom('営業部', '営業活動・顧客情報共有用');
    }
  } catch (error) {
    console.error('Failed to create demo rooms:', error);
  }
};

// Configuration test function
export const testFirebaseConfig = async (): Promise<{
  authEnabled: boolean;
  googleProviderEnabled: boolean;
  emailProviderEnabled: boolean;
  errors: string[];
}> => {
  const result = {
    authEnabled: false,
    googleProviderEnabled: false,
    emailProviderEnabled: false,
    errors: [] as string[]
  };

  try {
    // Test auth connection
    result.authEnabled = !!auth;
    
    // Test Google provider
    try {
      await signInWithPopup(auth, googleProvider);
      result.googleProviderEnabled = true;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('auth/operation-not-allowed')) {
          result.errors.push('Googleサインインが無効です');
        } else if (error.message.includes('auth/popup-closed-by-user')) {
          result.googleProviderEnabled = true; // User closed popup, but provider is enabled
        } else {
          result.errors.push(`Google認証エラー: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }
  
  return result;
};
