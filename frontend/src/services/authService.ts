import { apiEndpoints } from '@/config/env';
import { apiRequest } from './api';

export interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  role: string;
  created_at: string;
  subscription_tier: string;
}

export interface AuthTokens {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
}

export interface AuthData {
  user: User;
  tokens: AuthTokens;
}

class AuthService {
  /**
   * Login user with email and password
   */
  async login(email: string, password: string): Promise<AuthData> {
    try {
      // Create form data for OAuth2PasswordRequestForm
      const formData = new FormData();
      formData.append('username', email); // FastAPI uses 'username' field for email
      formData.append('password', password);

      const response = await fetch(apiEndpoints.auth.login, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }

      const tokenData = await response.json();

      // Get user profile with the token
      const userResponse = await fetch(apiEndpoints.auth.profile, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const userData = await userResponse.json();

      return {
        user: userData,
        tokens: {
          access_token: tokenData.access_token,
          token_type: tokenData.token_type || 'bearer',
          expires_in: tokenData.expires_in || 3600,
        },
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Register new user
   */
  async register(userData: RegisterData): Promise<AuthData> {
    try {
      const response = await fetch(apiEndpoints.auth.register, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
      }

      const registeredUser = await response.json();

      // After successful registration, login the user
      return await this.login(userData.email, userData.password);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<User> {
    try {
      const token = this.getStoredToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(apiEndpoints.auth.profile, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      return await response.json();
    } catch (error) {
      console.error('Get current user error:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUser(updates: Partial<User>): Promise<User> {
    try {
      const token = this.getStoredToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(apiEndpoints.auth.profile, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Profile update failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<AuthTokens> {
    try {
      const token = this.getStoredToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(apiEndpoints.auth.refresh, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const tokenData = await response.json();

      return {
        access_token: tokenData.access_token,
        token_type: tokenData.token_type || 'bearer',
        expires_in: tokenData.expires_in || 3600,
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const token = this.getStoredToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${apiEndpoints.auth.login.replace('/token', '/change-password')}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Password change failed');
      }
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      const token = this.getStoredToken();
      if (token) {
        // Call logout endpoint (optional - mainly for cleanup on server)
        await fetch(`${apiEndpoints.auth.login.replace('/token', '/logout')}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.warn('Logout API call failed:', error);
      // Don't throw error as logout should always succeed locally
    } finally {
      // Clear local storage regardless of API call success
      this.clearStoredAuth();
    }
  }

  /**
   * Get stored authentication token
   */
  private getStoredToken(): string | null {
    try {
      const tokens = localStorage.getItem('turtletrading-tokens');
      if (tokens) {
        const parsedTokens: AuthTokens = JSON.parse(tokens);
        return parsedTokens.access_token;
      }
      return null;
    } catch (error) {
      console.error('Error getting stored token:', error);
      return null;
    }
  }

  /**
   * Clear stored authentication data
   */
  private clearStoredAuth(): void {
    localStorage.removeItem('turtletrading-tokens');
    localStorage.removeItem('turtletrading-user');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const token = this.getStoredToken();
    if (!token) return false;

    try {
      // Check if token is expired
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp > currentTime;
    } catch (error) {
      console.error('Error checking token validity:', error);
      return false;
    }
  }

  /**
   * Get stored user data
   */
  getStoredUser(): User | null {
    try {
      const user = localStorage.getItem('turtletrading-user');
      return user ? JSON.parse(user) : null;
    } catch (error) {
      console.error('Error getting stored user:', error);
      return null;
    }
  }
}

// Create singleton instance
export const authService = new AuthService();

export default authService;