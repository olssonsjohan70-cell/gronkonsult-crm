import jwt
import bcrypt
import os
from datetime import datetime, timedelta
from typing import Optional

SECRET_KEY = os.getenv("SECRET_KEY", "gronkonsult-crm-secret-change-this-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24 * 7  # 1 week


def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, stored: str) -> bool:
    # stored can be plain text (from .env) or bcrypt hash
    if stored.startswith("$2b$") or stored.startswith("$2a$"):
        return bcrypt.checkpw(plain.encode(), stored.encode())
    return plain == stored  # plain comparison for simple .env setup
