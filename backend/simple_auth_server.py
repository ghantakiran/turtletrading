"""
Simple FastAPI server with basic authentication endpoints without Redis dependencies.
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Dict
import hashlib
import uuid
from datetime import datetime, timedelta

# Create FastAPI app
app = FastAPI(
    title="TurtleTrading Simple Auth Server",
    description="Basic authentication server for testing without Redis",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int

class UserCreate(BaseModel):
    full_name: str
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    is_active: bool
    created_at: datetime

# Simple in-memory user storage for testing
users_db: Dict[str, dict] = {
    "admin@turtletrading.com": {
        "id": str(uuid.uuid4()),
        "email": "admin@turtletrading.com",
        "full_name": "Admin User",
        "hashed_password": hashlib.sha256("Admin123!".encode()).hexdigest(),
        "is_active": True,
        "created_at": datetime.now()
    },
    "user@turtletrading.com": {
        "id": str(uuid.uuid4()),
        "email": "user@turtletrading.com",
        "full_name": "Regular User",
        "hashed_password": hashlib.sha256("User123!".encode()).hexdigest(),
        "is_active": True,
        "created_at": datetime.now()
    }
}

def hash_password(password: str) -> str:
    """Simple password hashing for testing"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return hash_password(plain_password) == hashed_password

def create_access_token(email: str) -> str:
    """Create a simple access token"""
    return f"simple_token_{email}_{datetime.now().timestamp()}"

@app.post("/api/v1/auth/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login endpoint"""
    try:
        # Get user from database
        user = users_db.get(form_data.username)
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Verify password
        if not verify_password(form_data.password, user["hashed_password"]):
            raise HTTPException(
                status_code=401,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Create access token
        access_token = create_access_token(user["email"])

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": 3600
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )

@app.post("/api/v1/auth/register", response_model=UserResponse)
async def register(user: UserCreate):
    """Register a new user"""
    try:
        # Check if user already exists
        if user.email in users_db:
            raise HTTPException(
                status_code=400,
                detail="Email already registered"
            )

        # Create new user
        user_id = str(uuid.uuid4())
        hashed_password = hash_password(user.password)

        new_user = {
            "id": user_id,
            "email": user.email,
            "full_name": user.full_name,
            "hashed_password": hashed_password,
            "is_active": True,
            "created_at": datetime.now()
        }

        # Save to database
        users_db[user.email] = new_user

        return UserResponse(
            id=new_user["id"],
            email=new_user["email"],
            full_name=new_user["full_name"],
            is_active=new_user["is_active"],
            created_at=new_user["created_at"]
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Registration error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )

@app.get("/api/v1/auth/me", response_model=UserResponse)
async def get_current_user():
    """Get current user info (simplified for testing)"""
    # For simplicity, return admin user info
    # In a real implementation, you'd validate the JWT token
    admin_user = users_db["admin@turtletrading.com"]
    return UserResponse(
        id=admin_user["id"],
        email=admin_user["email"],
        full_name=admin_user["full_name"],
        is_active=admin_user["is_active"],
        created_at=admin_user["created_at"]
    )

@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "Simple auth server is running"}

@app.get("/")
async def root():
    return {
        "message": "TurtleTrading Simple Authentication Server",
        "endpoints": ["/docs", "/health", "/api/v1/auth/token", "/api/v1/auth/register"],
        "demo_users": [
            {"email": "admin@turtletrading.com", "password": "Admin123!"},
            {"email": "user@turtletrading.com", "password": "User123!"}
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)