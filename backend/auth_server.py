"""
Simple FastAPI server with only authentication endpoints for testing.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints.auth import router as auth_router

# Create FastAPI app
app = FastAPI(
    title="TurtleTrading Auth Server",
    description="Authentication-only server for testing login/registration",
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

# Include only auth router
app.include_router(
    auth_router,
    prefix="/api/v1/auth",
    tags=["authentication"]
)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "Auth server is running"}

@app.get("/")
async def root():
    return {"message": "TurtleTrading Authentication Server", "endpoints": ["/docs", "/health", "/api/v1/auth"]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)