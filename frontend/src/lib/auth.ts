/**
 * Authentication utilities for SafeComm demo
 * Demo user system for Google Cloud Hackathon 2024
 */

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  avatar?: string;
}

export const DEMO_USERS: DemoUser[] = [
  {
    id: "user1",
    name: "田中 太郎",
    email: "tanaka@company.com",
    department: "営業部",
    role: "manager",
    avatar: "👨‍💼"
  },
  {
    id: "user2", 
    name: "佐藤 花子",
    email: "sato@company.com",
    department: "開発部",
    role: "developer",
    avatar: "👩‍💻"
  },
  {
    id: "user3",
    name: "山田 次郎",
    email: "yamada@company.com", 
    department: "人事部",
    role: "hr",
    avatar: "👨‍💼"
  },
  {
    id: "user4",
    name: "鈴木 美咲",
    email: "suzuki@company.com",
    department: "マーケティング部", 
    role: "marketing",
    avatar: "👩‍🎨"
  }
];

export const generateDemoToken = (user: DemoUser): string => {
  // デモ用簡易トークン生成
  const tokenData = {
    user_id: user.id,
    name: user.name,
    email: user.email,
    department: user.department,
    role: user.role,
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24時間
  };
  
  // Base64エンコード（実際のプロダクションではJWTを使用）
  return btoa(JSON.stringify(tokenData));
};

export const validateDemoToken = (token: string): DemoUser | null => {
  try {
    const tokenData = JSON.parse(atob(token));
    
    // 有効期限チェック
    if (tokenData.exp < Date.now()) {
      return null;
    }
    
    // ユーザー存在チェック
    const user = DEMO_USERS.find(u => u.id === tokenData.user_id);
    return user || null;
    
  } catch  {
    return null;
  }
};

export const getCurrentUser = (): DemoUser | null => {
  if (typeof window === 'undefined') return null;
  
  const token = localStorage.getItem('safecomm_demo_token');
  if (!token) return null;
  
  return validateDemoToken(token);
};

export const loginUser = (user: DemoUser): void => {
  const token = generateDemoToken(user);
  localStorage.setItem('safecomm_demo_token', token);
};

export const logoutUser = (): void => {
  localStorage.removeItem('safecomm_demo_token');
};
