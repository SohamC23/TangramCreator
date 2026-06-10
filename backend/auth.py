import os
import requests
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

REGION = os.environ["COGNITO_REGION"]
USER_POOL_ID = os.environ["COGNITO_USER_POOL_ID"]
APP_CLIENT_ID = os.environ["COGNITO_APP_CLIENT_ID"]

ISSUER = f"https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}"
JWKS_URL = f"{ISSUER}/.well-known/jwks.json"

# Fetch the public keys once at cold start and cache them.
_jwks = requests.get(JWKS_URL, timeout=5).json()["keys"]

bearer = HTTPBearer()

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> str:
    token = creds.credentials
    try:
        # Find the key whose ID matches the token's header.
        header = jwt.get_unverified_header(token)
        key = next(k for k in _jwks if k["kid"] == header["kid"])

        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=APP_CLIENT_ID,   # only if verifying an ID token
            issuer=ISSUER,
        )
    except (JWTError, StopIteration):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    # 'sub' is the stable, unique user ID. This is what scopes their data.
    return claims["sub"]