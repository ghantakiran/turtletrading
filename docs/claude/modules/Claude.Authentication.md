# Claude.Authentication

- **Purpose**: Provide comprehensive user authentication, authorization, session management, and security policies with JWT token handling, rate limiting, and multi-tier access control for secure trading platform access
- **Scope (in/out)**:
  - **In**: JWT token generation/validation, user registration/login, password hashing, session management, rate limiting, permission validation, security policies, multi-factor authentication
  - **Out**: User interface rendering (handled by UserInterface), business logic processing (handled by StockAnalysis/MarketData), data storage implementation (handled by Infrastructure)
- **Public API (signatures, inputs/outputs, errors)**:
  - `AuthService.register_user(email, password, profile) → UserAccount | ValidationError`
  - `AuthService.authenticate_user(email, password) → AuthResult | AuthenticationError`
  - `AuthService.generate_tokens(user_id) → TokenPair | TokenError`
  - `AuthService.refresh_token(refresh_token) → TokenPair | InvalidTokenError`
  - `AuthService.validate_jwt(token) → UserContext | TokenValidationError`
  - `RateLimitService.check_rate_limit(user_id, endpoint) → RateLimitResult | None`
  - `PermissionService.check_permission(user_context, resource) → PermissionResult | None`
- **Data contracts (schemas, invariants)**:
  - UserAccount: user_id(UUID), email(str, unique), password_hash(str), subscription_tier('free'|'pro'|'enterprise'), created_at(datetime), is_active(bool)
  - AuthResult: success(bool), user_context(UserContext|None), access_token(str|None), refresh_token(str|None), expires_in(int)
  - UserContext: user_id(UUID), email(str), subscription_tier(str), permissions(List[str]), session_expires_at(datetime), rate_limit_remaining(int)
  - TokenPair: access_token(str, 15min expiry), refresh_token(str, 7day expiry), token_type('Bearer'), expires_in(int)
  - RateLimitResult: allowed(bool), remaining(int≥0), reset_time(datetime), tier_limit(int>0)
- **Dependencies (internal/external)**:
  - **Internal**: Infrastructure (PostgreSQL user storage, Redis sessions), UserInterface (auth status), MarketData (user subscriptions), StockAnalysis (user preferences)
  - **External**: bcrypt, PyJWT, passlib, python-multipart, redis, sqlalchemy, pydantic, email-validator
- **State & concurrency model**: Stateless JWT validation with Redis session storage, async password hashing, concurrent rate limiting with atomic Redis operations
- **Failure modes & retries**: No retries for authentication (security), session cleanup on token expiry, password reset via email, account lockout after failed attempts
- **Performance/SLOs**: <100ms token validation, <200ms login/registration, <50ms rate limit checks, 99.9% authentication success for valid credentials
- **Security/permissions**: bcrypt password hashing, JWT with strong secrets, secure session cookies, rate limiting per user/IP, input validation, SQL injection prevention
- **Observability (logs/metrics/traces)**: Authentication success/failure rates, token generation/validation metrics, rate limit violations, session durations, security event logging
- **Change risks & migration notes**: JWT secret rotation requires careful token migration, password policy changes need user notification, rate limit updates require cache invalidation

## TDD: Requirements → Tests

### REQ-AUTH-01: User registration and authentication with secure password handling and session management
- **Unit tests**:
  - UT-AUTH-01.1: Given valid email/password When register_user() Then create account with hashed password and return user_id
  - UT-AUTH-01.2: Given valid credentials When authenticate_user() Then return JWT tokens and user context
  - UT-AUTH-01.3: Given user session When validate_jwt() Then verify token signature and return user permissions
- **Edge/negative/property tests**:
  - ET-AUTH-01.1: Given duplicate email When register_user() Then return ValidationError with clear message
  - ET-AUTH-01.2: Given invalid password When authenticate_user() Then return AuthenticationError and log attempt
  - PT-AUTH-01.1: Property: passwords always hashed with bcrypt, JWT tokens contain valid claims, user_ids are unique UUIDs
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock bcrypt with controlled hash generation for testing
  - Stub JWT with deterministic token generation
  - Fake Redis sessions for session management testing
- **Coverage mapping**:
  - Lines/branches/functions covered: register_user(), authenticate_user(), hash_password(), validate_jwt(), create_session()

### REQ-AUTH-02: JWT token management with access/refresh token rotation and secure validation
- **Unit tests**:
  - UT-AUTH-02.1: Given authenticated user When generate_tokens() Then return access token (15min) and refresh token (7day)
  - UT-AUTH-02.2: Given valid refresh token When refresh_token() Then return new token pair and invalidate old refresh token
  - UT-AUTH-02.3: Given expired access token When validate_jwt() Then return TokenValidationError with expiry details
- **Edge/negative/property tests**:
  - ET-AUTH-02.1: Given malformed JWT When validate_jwt() Then reject with proper error message and security logging
  - ET-AUTH-02.2: Given revoked refresh token When refresh_token() Then return InvalidTokenError and require re-authentication
  - PT-AUTH-02.1: Property: access tokens expire in 15 minutes, refresh tokens unique per user, token revocation is immediate
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock JWT library with controllable expiration times
  - Stub Redis for token blacklist management
  - Fake system clock for token expiry testing
- **Coverage mapping**:
  - Lines/branches/functions covered: generate_tokens(), refresh_token(), validate_jwt(), revoke_token(), check_blacklist()

### REQ-AUTH-03: Rate limiting and permission management with tier-based access control and security policies
- **Unit tests**:
  - UT-AUTH-03.1: Given user tier When check_rate_limit() Then enforce tier-specific limits (free: 100/hour, pro: 1000/hour, enterprise: unlimited)
  - UT-AUTH-03.2: Given user permissions When check_permission() Then validate access to premium features based on subscription
  - UT-AUTH-03.3: Given security policy When validate_request() Then enforce IP restrictions and suspicious activity detection
- **Edge/negative/property tests**:
  - ET-AUTH-03.1: Given rate limit exceeded When make_request() Then return 429 status with reset time headers
  - ET-AUTH-03.2: Given subscription downgrade When access_premium_feature() Then revoke permissions immediately
  - PT-AUTH-03.1: Property: rate limits reset at specified intervals, permissions consistent with subscription tier, security logs immutable
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock Redis atomic operations for rate limiting
  - Stub subscription service for tier validation
  - Fake IP geolocation for security policy testing
- **Coverage mapping**:
  - Lines/branches/functions covered: check_rate_limit(), check_permission(), validate_subscription(), enforce_security_policy()

### Traceability Matrix: REQ-IDs ↔ Tests
| REQ-ID | Unit Tests | Edge Tests | Property Tests | Integration Tests |
|--------|------------|------------|----------------|-------------------|
| REQ-AUTH-01 | UT-AUTH-01.1-3 | ET-AUTH-01.1-2 | PT-AUTH-01.1 | IT-AUTH-01 |
| REQ-AUTH-02 | UT-AUTH-02.1-3 | ET-AUTH-02.1-2 | PT-AUTH-02.1 | IT-AUTH-02 |
| REQ-AUTH-03 | UT-AUTH-03.1-3 | ET-AUTH-03.1-2 | PT-AUTH-03.1 | IT-AUTH-03 |

## Implementation Guidance (after specs)

### Algorithms/Flow
1. **User Registration**: validate_input() → check_email_unique() → hash_password() → create_user_record() → generate_tokens() → setup_session()
2. **Authentication**: validate_credentials() → verify_password() → check_account_status() → generate_tokens() → create_session() → return_auth_result()
3. **Token Validation**: parse_jwt() → verify_signature() → check_expiry() → validate_claims() → check_blacklist() → return_user_context()

### Pseudocode (reference)
```python
async def authenticate_user(email: str, password: str) -> AuthResult:
    # Input validation
    if not validate_email(email) or not password:
        return AuthResult(success=False, error="Invalid credentials format")

    # Rate limiting check
    rate_limit = await rate_limiter.check_login_attempts(email)
    if not rate_limit.allowed:
        await security_logger.log_rate_limit_violation(email, "login")
        return AuthResult(success=False, error="Too many login attempts")

    # Fetch user from database
    user = await user_repository.get_by_email(email)
    if not user or not user.is_active:
        await security_logger.log_failed_login(email, "user_not_found")
        return AuthResult(success=False, error="Invalid credentials")

    # Verify password
    is_valid = await bcrypt.verify(password, user.password_hash)
    if not is_valid:
        await security_logger.log_failed_login(email, "invalid_password")
        await rate_limiter.increment_failed_attempts(email)
        return AuthResult(success=False, error="Invalid credentials")

    # Generate JWT tokens
    token_payload = {
        "user_id": str(user.user_id),
        "email": user.email,
        "subscription_tier": user.subscription_tier,
        "permissions": get_user_permissions(user.subscription_tier),
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(minutes=15)
    }

    access_token = jwt.encode(token_payload, JWT_SECRET, algorithm="HS256")
    refresh_token = await generate_refresh_token(user.user_id)

    # Create session
    session_data = {
        "user_id": str(user.user_id),
        "login_time": datetime.utcnow().isoformat(),
        "ip_address": get_client_ip(),
        "user_agent": get_user_agent()
    }
    await redis.setex(f"session:{user.user_id}", 3600, json.dumps(session_data))

    # Update user last login
    await user_repository.update_last_login(user.user_id)

    # Log successful authentication
    await security_logger.log_successful_login(user.email, get_client_ip())

    return AuthResult(
        success=True,
        user_context=UserContext(
            user_id=user.user_id,
            email=user.email,
            subscription_tier=user.subscription_tier,
            permissions=get_user_permissions(user.subscription_tier),
            session_expires_at=datetime.utcnow() + timedelta(minutes=15),
            rate_limit_remaining=rate_limit.remaining
        ),
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=900  # 15 minutes
    )

async def validate_jwt(token: str) -> Optional[UserContext]:
    try:
        # Parse and verify JWT
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])

        # Check token blacklist
        is_blacklisted = await redis.get(f"blacklist:{token}")
        if is_blacklisted:
            raise TokenValidationError("Token has been revoked")

        # Validate user still exists and is active
        user = await user_repository.get_by_id(payload["user_id"])
        if not user or not user.is_active:
            raise TokenValidationError("User account is inactive")

        # Check subscription tier for permission changes
        current_permissions = get_user_permissions(user.subscription_tier)
        if current_permissions != payload.get("permissions", []):
            # Permissions changed, require re-authentication
            raise TokenValidationError("Permissions have changed, please re-authenticate")

        # Return user context
        return UserContext(
            user_id=UUID(payload["user_id"]),
            email=payload["email"],
            subscription_tier=user.subscription_tier,
            permissions=current_permissions,
            session_expires_at=datetime.fromtimestamp(payload["exp"]),
            rate_limit_remaining=await get_rate_limit_remaining(payload["user_id"])
        )

    except jwt.ExpiredSignatureError:
        raise TokenValidationError("Token has expired")
    except jwt.InvalidTokenError as e:
        await security_logger.log_invalid_token_attempt(token, str(e))
        raise TokenValidationError("Invalid token")
```

### Error Handling & Retries
- **Authentication failures**: No retries for security, log all attempts, implement account lockout
- **Token validation errors**: Immediate rejection, security logging, force re-authentication
- **Database connection issues**: Graceful degradation, cached user validation for short periods
- **Rate limiting**: Clear error messages with reset times, distinguish between user and IP limits

### Config/flags
```python
AUTH_CONFIG = {
    "JWT_CONFIG": {
        "SECRET_KEY": "your-256-bit-secret",  # From environment
        "ALGORITHM": "HS256",
        "ACCESS_TOKEN_EXPIRE_MINUTES": 15,
        "REFRESH_TOKEN_EXPIRE_DAYS": 7,
        "ISSUER": "turtletrading.com",
        "AUDIENCE": "turtletrading-api"
    },
    "PASSWORD_POLICY": {
        "MIN_LENGTH": 8,
        "MAX_LENGTH": 128,
        "REQUIRE_UPPERCASE": True,
        "REQUIRE_LOWERCASE": True,
        "REQUIRE_DIGITS": True,
        "REQUIRE_SPECIAL_CHARS": True,
        "BCRYPT_ROUNDS": 12
    },
    "RATE_LIMITS": {
        "LOGIN_ATTEMPTS": {
            "free": {"limit": 5, "window": 300},      # 5 attempts per 5 minutes
            "pro": {"limit": 10, "window": 300},      # 10 attempts per 5 minutes
            "enterprise": {"limit": 20, "window": 300} # 20 attempts per 5 minutes
        },
        "API_REQUESTS": {
            "free": {"limit": 100, "window": 3600},     # 100 requests per hour
            "pro": {"limit": 1000, "window": 3600},     # 1000 requests per hour
            "enterprise": {"limit": -1, "window": 3600} # Unlimited
        },
        "REGISTRATION": {"limit": 3, "window": 86400}   # 3 registrations per day per IP
    },
    "SECURITY_POLICIES": {
        "SESSION_TIMEOUT": 3600,  # 1 hour
        "MAX_CONCURRENT_SESSIONS": 5,
        "REQUIRE_EMAIL_VERIFICATION": True,
        "ENABLE_MFA": False,  # Future implementation
        "PASSWORD_RESET_EXPIRE_MINUTES": 30,
        "ACCOUNT_LOCKOUT_ATTEMPTS": 10,
        "ACCOUNT_LOCKOUT_DURATION": 1800  # 30 minutes
    },
    "SUBSCRIPTION_PERMISSIONS": {
        "free": [
            "view_basic_charts",
            "access_basic_indicators",
            "create_watchlist"
        ],
        "pro": [
            "view_basic_charts", "access_basic_indicators", "create_watchlist",
            "view_advanced_charts",
            "access_all_indicators",
            "lstm_predictions",
            "sentiment_analysis",
            "real_time_data"
        ],
        "enterprise": [
            "view_basic_charts", "access_basic_indicators", "create_watchlist",
            "view_advanced_charts", "access_all_indicators", "lstm_predictions",
            "sentiment_analysis", "real_time_data",
            "api_access",
            "bulk_analysis",
            "custom_indicators",
            "priority_support"
        ]
    }
}
```

### Error Handling & Retries
- **Authentication failures**: No retries for security, log all attempts, implement account lockout
- **Token validation errors**: Immediate rejection, security logging, force re-authentication
- **Database connection issues**: Graceful degradation, cached user validation for short periods
- **Rate limiting**: Clear error messages with reset times, distinguish between user and IP limits

### Config/flags
```python
AUTH_CONFIG = {
    "JWT_CONFIG": {
        "SECRET_KEY": "your-256-bit-secret",  # From environment
        "ALGORITHM": "HS256",
        "ACCESS_TOKEN_EXPIRE_MINUTES": 15,
        "REFRESH_TOKEN_EXPIRE_DAYS": 7,
        "ISSUER": "turtletrading.com",
        "AUDIENCE": "turtletrading-api"
    },
    "PASSWORD_POLICY": {
        "MIN_LENGTH": 8,
        "MAX_LENGTH": 128,
        "REQUIRE_UPPERCASE": True,
        "REQUIRE_LOWERCASE": True,
        "REQUIRE_DIGITS": True,
        "REQUIRE_SPECIAL_CHARS": True,
        "BCRYPT_ROUNDS": 12
    },
    "RATE_LIMITS": {
        "LOGIN_ATTEMPTS": {
            "free": {"limit": 5, "window": 300},      # 5 attempts per 5 minutes
            "pro": {"limit": 10, "window": 300},      # 10 attempts per 5 minutes
            "enterprise": {"limit": 20, "window": 300} # 20 attempts per 5 minutes
        },
        "API_REQUESTS": {
            "free": {"limit": 100, "window": 3600},     # 100 requests per hour
            "pro": {"limit": 1000, "window": 3600},     # 1000 requests per hour
            "enterprise": {"limit": -1, "window": 3600} # Unlimited
        },
        "REGISTRATION": {"limit": 3, "window": 86400}   # 3 registrations per day per IP
    },
    "SECURITY_POLICIES": {
        "SESSION_TIMEOUT": 3600,  # 1 hour
        "MAX_CONCURRENT_SESSIONS": 5,
        "REQUIRE_EMAIL_VERIFICATION": True,
        "ENABLE_MFA": False,  # Future implementation
        "PASSWORD_RESET_EXPIRE_MINUTES": 30,
        "ACCOUNT_LOCKOUT_ATTEMPTS": 10,
        "ACCOUNT_LOCKOUT_DURATION": 1800  # 30 minutes
    },
    "SUBSCRIPTION_PERMISSIONS": {
        "free": [
            "view_basic_charts",
            "access_basic_indicators",
            "create_watchlist"
        ],
        "pro": [
            "view_basic_charts", "access_basic_indicators", "create_watchlist",
            "view_advanced_charts",
            "access_all_indicators",
            "lstm_predictions",
            "sentiment_analysis",
            "real_time_data"
        ],
        "enterprise": [
            "view_basic_charts", "access_basic_indicators", "create_watchlist",
            "view_advanced_charts", "access_all_indicators", "lstm_predictions",
            "sentiment_analysis", "real_time_data",
            "api_access",
            "bulk_analysis",
            "custom_indicators",
            "priority_support"
        ]
    }
}
```