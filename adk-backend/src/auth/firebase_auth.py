"""
Firebase Authentication Integration
Firebase Admin SDK を使用したユーザー認証
"""

import logging
from typing import Dict, Any, Optional
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import credentials, auth

logger = logging.getLogger(__name__)

# Firebase Admin SDK 初期化
try:
    # デモ用：Service Account Key がない場合はデフォルト認証を使用
    if not firebase_admin._apps:
        # プロダクションでは service account key を使用
        # cred = credentials.Certificate('path/to/serviceAccountKey.json')
        # firebase_admin.initialize_app(cred)

        # デモ用：デフォルト認証
        firebase_admin.initialize_app()
        logger.info("Firebase Admin SDK initialized with default credentials")
except Exception as e:
    logger.warning(f"Firebase Admin SDK initialization failed: {e}")
    logger.info("Running in demo mode without Firebase authentication")

# HTTP Bearer token scheme
security = HTTPBearer()


async def verify_firebase_token(token: str) -> Dict[str, Any]:
    """Firebase ID トークンを検証"""
    try:
        # Firebase ID トークンを検証
        decoded_token = auth.verify_id_token(token)
        return {
            "uid": decoded_token["uid"],
            "email": decoded_token.get("email"),
            "name": decoded_token.get("name"),
            "email_verified": decoded_token.get("email_verified", False),
            "firebase_claims": decoded_token,
        }
    except Exception as e:
        logger.error(f"Firebase token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Dict[str, Any]:
    """認証トークン検証（Firebase認証）"""

    token = credentials.credentials

    # Firebase認証
    return await verify_firebase_token(token)


async def get_current_user_info(
    user_data: Dict[str, Any] = Depends(verify_token),
) -> Dict[str, Any]:
    """現在のユーザー情報を取得"""
    return user_data


# Firebase Admin SDK ユーティリティ関数
async def get_user_by_uid(uid: str) -> Optional[Dict[str, Any]]:
    """UIDでユーザー情報を取得"""
    try:
        user_record = auth.get_user(uid)
        return {
            "uid": user_record.uid,
            "email": user_record.email,
            "display_name": user_record.display_name,
            "email_verified": user_record.email_verified,
            "created_at": user_record.user_metadata.creation_timestamp,
            "last_sign_in": user_record.user_metadata.last_sign_in_timestamp,
        }
    except Exception as e:
        logger.error(f"Failed to get user by UID {uid}: {e}")
        return None


async def create_custom_token(
    uid: str, additional_claims: Optional[Dict[str, Any]] = None
) -> str:
    """カスタムトークンを作成"""
    try:
        return auth.create_custom_token(uid, additional_claims)
    except Exception as e:
        logger.error(f"Failed to create custom token for UID {uid}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create authentication token",
        )


async def revoke_refresh_tokens(uid: str) -> bool:
    """ユーザーのリフレッシュトークンを無効化"""
    try:
        auth.revoke_refresh_tokens(uid)
        return True
    except Exception as e:
        logger.error(f"Failed to revoke tokens for UID {uid}: {e}")
        return False
