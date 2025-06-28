"""
認証・認可システム（ハッカソン用簡易版）
"""

import jwt
from fastapi import HTTPException, status
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

# デモ用プリセットユーザー
DEMO_USERS = {
    "1": {
        "id": "1",
        "name": "田中マネージャー",
        "email": "tanaka@demo.com",
        "department": "engineering",
        "role": "manager",
    },
    "2": {
        "id": "2",
        "name": "佐藤エンジニア",
        "email": "sato@demo.com",
        "department": "engineering",
        "role": "member",
    },
    "3": {
        "id": "3",
        "name": "鈴木営業",
        "email": "suzuki@demo.com",
        "department": "sales",
        "role": "member",
    },
    "4": {
        "id": "4",
        "name": "HR山田",
        "email": "yamada@demo.com",
        "department": "hr",
        "role": "admin",
    },
}


async def verify_token(authorization: str = None) -> Dict[str, Any]:
    """JWTトークン検証（ハッカソン用簡易版）"""
    if not authorization:
        # デモ用：認証なしでも動作
        return {
            "user_id": "2",
            "name": "佐藤エンジニア",
            "department": "engineering",
            "role": "member",
        }

    try:
        # Bearer トークンの処理
        if authorization.startswith("Bearer "):
            token = authorization.split(" ")[1]
        else:
            token = authorization

        # デモ用：簡単なトークン検証
        if token in DEMO_USERS:
            return DEMO_USERS[token]

        # JWT デコード（本番用）
        # decoded_token = jwt.decode(
        #     token,
        #     settings.jwt_secret_key,
        #     algorithms=["HS256"]
        # )
        # return decoded_token

        # デモ用フォールバック
        return DEMO_USERS["2"]

    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
        # ハッカソン用：エラーでもデフォルトユーザーを返す
        return DEMO_USERS["2"]


async def check_permissions(
    user: Dict[str, Any], required_role: str = None
) -> bool:
    """権限チェック"""
    if not required_role:
        return True

    user_role = user.get("role", "member")

    # 権限レベル定義
    role_hierarchy = {"member": 1, "manager": 2, "admin": 3}

    user_level = role_hierarchy.get(user_role, 1)
    required_level = role_hierarchy.get(required_role, 1)

    return user_level >= required_level


def generate_demo_token(user_id: str) -> str:
    """デモ用トークン生成"""
    return user_id  # 簡易版：ユーザーIDをそのままトークンとして使用
