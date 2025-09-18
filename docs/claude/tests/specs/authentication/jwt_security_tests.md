# Authentication • JWT Security Tests

- **REQ-IDs covered**: REQ-AUTH-01, REQ-AUTH-02, REQ-AUTH-03
- **Given/When/Then scenarios**:

## UT-AUTH-01.1: JWT Token Generation and Validation
**Given**: Valid user credentials and authentication request
**When**: generate_jwt_token() creates access and refresh tokens
**Then**: Tokens are properly signed, have correct expiration, and validate successfully

```python
def test_jwt_token_generation():
    # Arrange
    user_data = {
        'user_id': 'user123',
        'email': 'test@example.com',
        'subscription_tier': 'pro'
    }

    # Act
    tokens = auth_service.generate_jwt_token(user_data)

    # Assert
    assert 'access_token' in tokens
    assert 'refresh_token' in tokens

    # Validate access token
    decoded = jwt.decode(tokens['access_token'], JWT_SECRET, algorithms=['HS256'])
    assert decoded['user_id'] == 'user123'
    assert decoded['exp'] > time.time()  # Not expired
    assert decoded['iat'] <= time.time()  # Issued in past or now

    # Validate refresh token
    refresh_decoded = jwt.decode(tokens['refresh_token'], JWT_SECRET, algorithms=['HS256'])
    assert refresh_decoded['type'] == 'refresh'
    assert refresh_decoded['user_id'] == 'user123'
```

## UT-AUTH-01.2: Token Expiration Handling
**Given**: Expired JWT access token
**When**: validate_jwt_token() processes expired token
**Then**: Return token expired error and suggest refresh

```python
def test_expired_token_handling():
    # Arrange
    expired_token = auth_service.generate_expired_token('user123')  # Test helper

    # Act
    validation_result = auth_service.validate_jwt_token(expired_token)

    # Assert
    assert validation_result['valid'] == False
    assert validation_result['error'] == 'TOKEN_EXPIRED'
    assert validation_result['suggestion'] == 'refresh_token_required'
    assert 'user_id' not in validation_result  # No user data for expired token
```

## UT-AUTH-02.1: Rate Limiting Authentication Attempts
**Given**: Multiple failed login attempts from same IP
**When**: attempt_login() is called repeatedly with wrong credentials
**Then**: Implement rate limiting after 5 failed attempts in 15 minutes

```python
async def test_authentication_rate_limiting():
    # Arrange
    ip_address = '192.168.1.100'
    invalid_credentials = {'email': 'test@example.com', 'password': 'wrong_password'}

    # Act - Make 5 failed attempts
    failed_attempts = []
    for i in range(5):
        result = await auth_service.attempt_login(invalid_credentials, ip_address)
        failed_attempts.append(result)

    # 6th attempt should be rate limited
    rate_limited_result = await auth_service.attempt_login(invalid_credentials, ip_address)

    # Assert
    for attempt in failed_attempts:
        assert attempt['success'] == False
        assert attempt['error'] == 'INVALID_CREDENTIALS'

    assert rate_limited_result['success'] == False
    assert rate_limited_result['error'] == 'RATE_LIMITED'
    assert rate_limited_result['retry_after'] > 0  # Seconds until retry allowed
```

## UT-AUTH-03.1: Password Security and Hashing
**Given**: User registration with plaintext password
**When**: hash_password() processes the password
**Then**: Store bcrypt hashed password, never store plaintext

```python
def test_password_hashing_security():
    # Arrange
    plaintext_password = 'MySecurePassword123!'

    # Act
    hashed = auth_service.hash_password(plaintext_password)

    # Assert
    assert hashed != plaintext_password  # Never store plaintext
    assert hashed.startswith('$2b$')  # bcrypt hash format
    assert len(hashed) == 60  # Standard bcrypt hash length

    # Verify password can be validated
    is_valid = auth_service.verify_password(plaintext_password, hashed)
    assert is_valid == True

    # Verify wrong password fails
    is_invalid = auth_service.verify_password('WrongPassword', hashed)
    assert is_invalid == False
```

## ET-AUTH-01.1: Malformed JWT Token Handling
**Given**: Malformed or tampered JWT token
**When**: validate_jwt_token() processes invalid token
**Then**: Handle gracefully without exposing internal errors

```python
def test_malformed_jwt_handling():
    # Arrange
    malformed_tokens = [
        'invalid.jwt.token',
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.tampered.signature',
        '',
        None,
        'Bearer malformed_token_here'
    ]

    for token in malformed_tokens:
        # Act
        result = auth_service.validate_jwt_token(token)

        # Assert
        assert result['valid'] == False
        assert result['error'] in ['INVALID_TOKEN', 'MALFORMED_TOKEN']
        assert 'user_id' not in result
        # Ensure no internal error details leaked
        assert 'traceback' not in result
        assert 'exception' not in result
```

## ET-AUTH-02.1: SQL Injection in Authentication
**Given**: Malicious SQL injection attempt in email field
**When**: attempt_login() processes malicious input
**Then**: Parameterized queries prevent SQL injection attacks

```python
async def test_sql_injection_prevention():
    # Arrange
    malicious_credentials = {
        'email': "admin@example.com'; DROP TABLE users; --",
        'password': 'any_password'
    }

    # Act
    result = await auth_service.attempt_login(malicious_credentials)

    # Assert
    assert result['success'] == False
    assert result['error'] == 'INVALID_CREDENTIALS'

    # Verify database integrity - users table should still exist
    user_count = await db_service.count_users()
    assert user_count >= 0  # Table exists and queryable
```

## PT-AUTH-01.1: Session Security Properties
**Given**: Valid authentication session
**When**: User performs authenticated actions
**Then**: Session maintains security properties throughout lifecycle

```python
async def test_session_security_properties():
    # Arrange
    user_credentials = {'email': 'test@example.com', 'password': 'ValidPassword123!'}

    # Act - Create session
    login_result = await auth_service.attempt_login(user_credentials)
    access_token = login_result['access_token']

    # Property 1: Token should validate consistently
    for _ in range(10):
        validation = auth_service.validate_jwt_token(access_token)
        assert validation['valid'] == True
        assert validation['user_id'] == login_result['user_id']

    # Property 2: Token should expire at predicted time
    token_payload = jwt.decode(access_token, options={"verify_signature": False})
    predicted_expiry = token_payload['exp']

    # Wait until just before expiry
    time_until_expiry = predicted_expiry - time.time()
    if time_until_expiry > 1:
        await asyncio.sleep(max(0, time_until_expiry - 0.5))

    validation_before_expiry = auth_service.validate_jwt_token(access_token)
    assert validation_before_expiry['valid'] == True

    # Wait past expiry
    await asyncio.sleep(1)
    validation_after_expiry = auth_service.validate_jwt_token(access_token)
    assert validation_after_expiry['valid'] == False
```

- **Mocks/stubs/fakes**:
  - MockDatabase for user credential storage testing
  - Stub Redis for rate limiting and session management
  - Fake time provider for token expiration testing

- **Deterministic seeds & time controls**:
  - Fixed JWT secret for reproducible token generation
  - Controlled time advancement for expiration testing
  - Deterministic user IDs and email addresses

- **Expected coverage deltas**:
  - Lines: +98 lines (JWT handling, password hashing, rate limiting, validation)
  - Branches: +18 branches (token validation paths, error handling, security checks)
  - Functions: +7 functions (generate_token, validate_token, hash_password, rate_limit_check)