import { createContext, useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";

const AuthContext = createContext();

const API_URL = import.meta.env.VITE_BACKEND_URL;

export const AuthProvider = ({ children }) => {
  // Initialize user state without sessionStorage
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // New function to refresh access token
  const refreshAccessToken = async () => {
    try {
      // Direct axios call to avoid recursion with api interceptors
      const response = await api.post('/auth/refresh-token');
      
      if (response.data.token) {
        localStorage.setItem('access_token', response.data.token);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const verifyUser = async () => {
      try {
        // Check if we're returning from Google auth
        const urlParams = new URLSearchParams(window.location.search);
        const googleAuth = urlParams.get('auth') === 'google';
        const googleAuthInProgress = localStorage.getItem('googleAuthInProgress');
        
        if (googleAuth) {
          // Clear the Google auth in progress flag
          localStorage.removeItem('googleAuthInProgress');
          
          // Immediately clear URL parameters to prevent refresh issues
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // If we have URL user data, use it immediately
          const urlUser = urlParams.get('user');
          const urlToken = urlParams.get('token');
          
          if (urlUser) {
            try {
              const userData = JSON.parse(decodeURIComponent(urlUser));
              setUser(userData);
              setLoading(false);
              
              // Save token to localStorage if available
              if (urlToken) {
                localStorage.setItem('access_token', urlToken);
              }
              return; // Skip further verification
            } catch (e) {
              console.error("Error parsing user data from URL", e);
            }
          }
        }
        
        const error = urlParams.get('error');
        if (error === 'auth_failed') {
          console.error('Google authentication failed');
          setUser(null);
          setLoading(false);
          return;
        }

        // Only perform token verification if no Google auth data
        if (!googleAuth) {
          try {
            const response = await api.get('/auth/check-auth');
            setUser(response.data);
          } catch (error) {
            // Handle error - but don't need special 401 handling as api utility does that
            console.error("Auth check failed:", error);
            setUser(null);
            
            // Only redirect if not on non-auth paths
            const nonAuthPaths = ['/login', '/signup', '/'];
            if (!nonAuthPaths.includes(window.location.pathname)) {
              navigate('/login');
            }
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Auth verification failed:", error);
        setUser(null);
        setLoading(false);
        
        // Only redirect if not on non-auth paths
        const nonAuthPaths = ['/login', '/signup', '/'];
        if (!nonAuthPaths.includes(window.location.pathname)) {
          navigate('/login');
        }
      }
    };

    verifyUser();
    
    return () => {
      isMounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authParam = params.get('auth');
    const userParam = params.get('user');
    const tokenParam = params.get('token');
    const authSuccess = params.get('authSuccess');
    
    if (authParam === 'google' && userParam && tokenParam && authSuccess) {
      try {
        const userData = JSON.parse(decodeURIComponent(userParam));
        
        // Store token in localStorage
        localStorage.setItem('access_token', tokenParam);
        
        // Update state with user info
        setUser(userData);
        
        // Clear URL params
        window.history.replaceState({}, document.title, '/chat');
      } catch (error) {
        console.error('Error processing auth callback:', error);
      }
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await api.get('/auth/check-auth');
      setUser(response.data);
    } catch (error) {
      console.error("Auth check failed:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      
      // Store token in localStorage if returned by backend
      if (response.data.token) {
        localStorage.setItem('access_token', response.data.token);
      }
      
      setUser({
        ...response.data,
        profilePicture: response.data.profilePicture
      });
      navigate("/chat");
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const signup = async (name, email, password) => {
    try {
      const response = await api.post('/auth/signup', { name, email, password });
      
      // Store token in localStorage if returned by backend
      if (response.data.token) {
        localStorage.setItem('access_token', response.data.token);
      }
      
      setUser(response.data);
      navigate("/chat");
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Signup failed');
    }
  };

  const logout = async () => {
    try {
      // Get the access token
      const token = localStorage.getItem('access_token');
      
      // Only make the logout request if we have a token
      if (token) {
        await api.post('/auth/logout');
      }
      
      // Clear user state and storage regardless of request success
      setUser(null);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      
      // Clear any other stored user data
      localStorage.removeItem('intendedPath');
      localStorage.removeItem('googleAuthInProgress');
      
      // Navigate to login
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      // Still clear everything even if the request fails
      setUser(null);
      localStorage.clear();
      navigate("/login");
    }
  };
  
  const signInWithGoogle = () => {
    try {
      // Store current path before redirect
      const currentPath = window.location.pathname;
      localStorage.setItem('intendedPath', currentPath === '/login' ? '/chat' : currentPath);
      
      // Set auth flow flag
      localStorage.setItem('googleAuthInProgress', 'true');
      
      // Add cache-busting timestamp and keep the consent parameter
      const timestamp = Date.now();
      const googleAuthUrl = `${API_URL}/auth/google?` +
        `t=${timestamp}&` +
        `prompt=consent+select_account`;  // Keep the consent parameter
      
      // Use window.location.href for consistent behavior
      window.location.href = googleAuthUrl;
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw new Error('Failed to initiate Google sign-in');
    }
  };

  // Update the Google auth callback handler
  const handleGoogleAuthCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const authType = urlParams.get('auth');
    const userInfo = urlParams.get('user');
    const token = urlParams.get('token');

    if (authType === 'google' && userInfo && token) {
      try {
        const userData = JSON.parse(decodeURIComponent(userInfo));
        
        // Store token
        localStorage.setItem('access_token', token);
        
        // Set user state
        setUser(userData);
        
        // Clear auth flow flags
        localStorage.removeItem('googleAuthInProgress');
        
        // Navigate to chat page after successful auth
        navigate('/chat');
        
        return true;
      } catch (error) {
        console.error('Error handling Google auth callback:', error);
        return false;
      }
    }
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        checkAuthStatus,
        signInWithGoogle,
        handleGoogleAuthCallback,
        refreshAccessToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};