"""
Notification API Endpoints
Handles push notification subscriptions and preferences
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User

router = APIRouter()


# Pydantic models for request/response
class PushSubscription(BaseModel):
    endpoint: str
    keys: dict  # Contains p256dh and auth keys


class SubscribeRequest(BaseModel):
    subscription: PushSubscription


class NotificationPreferences(BaseModel):
    priceAlerts: bool = True
    newsAlerts: bool = True
    aiSignals: bool = True
    portfolioUpdates: bool = True


class SendNotificationRequest(BaseModel):
    title: str
    body: str
    url: Optional[str] = "/dashboard"
    icon: Optional[str] = "/icons/icon-192x192.png"
    type: Optional[str] = "general"
    symbol: Optional[str] = None
    price: Optional[float] = None


# In-memory storage for demo (replace with database in production)
subscriptions_db = {}
preferences_db = {}


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe_to_notifications(
    request: SubscribeRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Subscribe user to push notifications
    Stores the push subscription endpoint and keys
    """
    user_id = current_user.id

    # Store subscription
    subscriptions_db[user_id] = {
        "endpoint": request.subscription.endpoint,
        "keys": request.subscription.keys,
        "created_at": datetime.utcnow().isoformat(),
    }

    return {
        "message": "Successfully subscribed to notifications",
        "subscription": subscriptions_db[user_id]
    }


@router.post("/unsubscribe", status_code=status.HTTP_200_OK)
async def unsubscribe_from_notifications(
    current_user: User = Depends(get_current_user)
):
    """
    Unsubscribe user from push notifications
    Removes the push subscription
    """
    user_id = current_user.id

    if user_id in subscriptions_db:
        del subscriptions_db[user_id]
        return {"message": "Successfully unsubscribed from notifications"}

    return {"message": "No active subscription found"}


@router.get("/subscription", status_code=status.HTTP_200_OK)
async def get_subscription(
    current_user: User = Depends(get_current_user)
):
    """
    Get current push subscription for user
    """
    user_id = current_user.id

    if user_id in subscriptions_db:
        return {
            "subscribed": True,
            "subscription": subscriptions_db[user_id]
        }

    return {"subscribed": False, "subscription": None}


@router.get("/preferences", response_model=NotificationPreferences)
async def get_notification_preferences(
    current_user: User = Depends(get_current_user)
):
    """
    Get user's notification preferences
    """
    user_id = current_user.id

    # Return stored preferences or defaults
    if user_id in preferences_db:
        return preferences_db[user_id]

    # Default preferences
    return NotificationPreferences()


@router.put("/preferences", response_model=NotificationPreferences)
async def update_notification_preferences(
    preferences: NotificationPreferences,
    current_user: User = Depends(get_current_user)
):
    """
    Update user's notification preferences
    """
    user_id = current_user.id

    # Store preferences
    preferences_db[user_id] = preferences.dict()

    return preferences


@router.post("/send", status_code=status.HTTP_200_OK)
async def send_notification(
    notification: SendNotificationRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Send a test notification to the current user
    In production, this would use web-push library to send actual push notifications
    """
    user_id = current_user.id

    if user_id not in subscriptions_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active subscription found. Subscribe to notifications first."
        )

    # In production, use pywebpush library:
    # from pywebpush import webpush, WebPushException
    #
    # subscription_info = subscriptions_db[user_id]
    # payload = {
    #     "title": notification.title,
    #     "body": notification.body,
    #     "url": notification.url,
    #     "icon": notification.icon,
    #     "type": notification.type,
    #     "symbol": notification.symbol,
    #     "price": notification.price,
    # }
    #
    # try:
    #     webpush(
    #         subscription_info=subscription_info,
    #         data=json.dumps(payload),
    #         vapid_private_key=settings.VAPID_PRIVATE_KEY,
    #         vapid_claims={
    #             "sub": f"mailto:{settings.VAPID_EMAIL}"
    #         }
    #     )
    # except WebPushException as ex:
    #     raise HTTPException(
    #         status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    #         detail=f"Failed to send notification: {ex}"
    #     )

    # For now, return success response
    return {
        "message": "Notification sent successfully (demo mode)",
        "notification": notification.dict(),
        "subscription": subscriptions_db[user_id]["endpoint"]
    }


@router.get("/test", status_code=status.HTTP_200_OK)
async def test_notification_endpoint():
    """
    Test endpoint to verify notifications API is working
    """
    return {
        "message": "Notifications API is working",
        "version": "1.0.0",
        "endpoints": [
            "POST /subscribe",
            "POST /unsubscribe",
            "GET /subscription",
            "GET /preferences",
            "PUT /preferences",
            "POST /send",
        ]
    }
