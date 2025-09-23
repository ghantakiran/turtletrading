"""
Vercel serverless function adapter for FastAPI backend
This file adapts the FastAPI application to run on Vercel's serverless platform
"""

import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

try:
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from mangum import Mangum

    # Import your main FastAPI app
    from app.main import app as fastapi_app

    # Configure CORS for Vercel deployment
    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "https://*.vercel.app",
            "https://turtletrading.vercel.app",
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3003"
        ],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # Create the Mangum handler for Vercel
    handler = Mangum(fastapi_app, lifespan="off")

    # Vercel expects a function named 'handler' or the default export
    def lambda_handler(event, context):
        """
        AWS Lambda/Vercel compatible handler
        """
        return handler(event, context)

except ImportError as e:
    print(f"Import error: {e}")
    # Fallback minimal FastAPI app for testing
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI(title="TurtleTrading API - Vercel Fallback")

    @app.get("/")
    async def root():
        return {"message": "TurtleTrading API running on Vercel", "status": "fallback"}

    @app.get("/health")
    async def health():
        return {"status": "healthy", "platform": "vercel", "mode": "fallback"}

    handler = Mangum(app, lifespan="off")

    def lambda_handler(event, context):
        return handler(event, context)

# Export for Vercel
app = fastapi_app if 'fastapi_app' in locals() else app