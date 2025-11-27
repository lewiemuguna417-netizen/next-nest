import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi, LoginRequest, LoginResponse, User } from '@/lib/api';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('paxform_token');
      const storedUser = localStorage.getItem('paxform_user');

      if (token && storedUser) {
        try {
          // Verify token is still valid by fetching user profile
          const userProfile = await authApi.getProfile();
          setUser(userProfile);
        } catch (error) {
          // Token is invalid, clear storage
          localStorage.removeItem('paxform_token');
          localStorage.removeItem('paxform_user');
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials: LoginRequest): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await authApi.login(credentials);
      
      // Store token and user data
      localStorage.setItem('paxform_token', response.access_token);
      localStorage.setItem('paxform_user', JSON.stringify(response.user));
      setUser(response.user);
      
      toast.success('Login successful!', {
        description: 'Welcome to PAXFORM Admin Dashboard',
      });
      
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed. Please try again.';
      toast.error('Login failed', {
        description: message,
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Clear storage
    localStorage.removeItem('paxform_token');
    localStorage.removeItem('paxform_user');
    setUser(null);
    
    toast.success('Logged out successfully');
  };

  const refreshUser = async () => {
    try {
      const userProfile = await authApi.getProfile();
      setUser(userProfile);
      localStorage.setItem('paxform_user', JSON.stringify(userProfile));
    } catch (error) {
      // If refresh fails, logout user
      logout();
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;