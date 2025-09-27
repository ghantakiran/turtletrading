// Mock implementation of jose library for Jest testing

// Mock JWT signing
export const SignJWT = jest.fn().mockImplementation(() => ({
  setProtectedHeader: jest.fn().mockReturnThis(),
  setIssuedAt: jest.fn().mockReturnThis(),
  setExpirationTime: jest.fn().mockReturnThis(),
  setSubject: jest.fn().mockReturnThis(),
  sign: jest.fn().mockResolvedValue('mock.jwt.token'),
}));

// Mock JWT verification
export const jwtVerify = jest.fn().mockImplementation((token, secret) => {
  if (token === 'valid.jwt.token') {
    return Promise.resolve({
      payload: {
        sub: 'user123',
        email: 'test@example.com',
        role: 'user',
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        iat: Math.floor(Date.now() / 1000),
      },
    });
  }

  if (token === 'expired.jwt.token') {
    const error = new Error('Token expired');
    error.code = 'ERR_JWT_EXPIRED';
    return Promise.reject(error);
  }

  if (token === 'invalid.jwt.token') {
    const error = new Error('Invalid token');
    error.code = 'ERR_JWS_INVALID';
    return Promise.reject(error);
  }

  // Default to invalid token
  const error = new Error('Invalid signature');
  error.code = 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED';
  return Promise.reject(error);
});

// Mock errors for testing different scenarios
export const errors = {
  JWTExpired: class JWTExpired extends Error {
    constructor(message) {
      super(message);
      this.code = 'ERR_JWT_EXPIRED';
    }
  },
  JWSInvalid: class JWSInvalid extends Error {
    constructor(message) {
      super(message);
      this.code = 'ERR_JWS_INVALID';
    }
  },
  JWSSignatureVerificationFailed: class JWSSignatureVerificationFailed extends Error {
    constructor(message) {
      super(message);
      this.code = 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED';
    }
  },
};