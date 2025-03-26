import { createContext, useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const AuthContext = createContext();

const API_URL = import.meta.env.VITE_BACKEND_URL || 'https://vanni-test-backend.vercel.app';

// Create an axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // This ensures cookies are sent with requests
});

export const AuthProvider = ({ children }) => {
  // Initialize user and token from localStorage if available
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Set up request interceptor to include token in all requests
  useEffect(() => {
    const requestInterceptor = api.interceptors.request.use(
      (config) => {
        console.log("Making request to:", config.url);
        return config;
      },
      (error) => {
        console.error("Request error:", error);
        return Promise.reject(error);
      }
    );

    const responseInterceptor = api.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        console.error("Response error:", error.response?.status, error.response?.data);
        
        // Handle 401 unauthorized errors
        if (error.response && error.response.status === 401) {
          console.log("401 Unauthorized detected, clearing user state");
          setUser(null);
          localStorage.removeItem('user');
        }
        
        return Promise.reject(error);
      }
    );

    return () => {
      // Clean up interceptors when component unmounts
      api.interceptors.request.eject(requestInterceptor);
      api.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // Check auth status on initial load and when user changes
  useEffect(() => {
    let isMounted = true;

    const verifyUser = async () => {
      try {
        console.log('Verifying user authentication');
        
        // Handle Google auth redirect
        const urlParams = new URLSearchParams(window.location.search);
        const googleAuth = urlParams.get('auth') === 'google';
        
        if (googleAuth) {
          console.log('Handling Google auth redirect');
          const urlUser = urlParams.get('user');
          
          if (urlUser) {
            const userData = JSON.parse(decodeURIComponent(urlUser));
            if (isMounted) {
              console.log('Setting user from Google auth:', userData);
              setUser(userData);
              localStorage.setItem('user', JSON.stringify(userData));
              setLoading(false);
              
              // Clean up URL parameters
              window.history.replaceState({}, document.title, '/chat');
              navigate('/chat');
              return;
            }
          }
        }
        
        const error = urlParams.get('error');
        if (error === 'auth_failed') {
          console.error('Authentication failed');
          if (isMounted) {
            setUser(null);
            localStorage.removeItem('user');
            setLoading(false);
            navigate('/login');
          }
          return;
        }
        
        // Check auth status with backend
        console.log('Checking auth status with backend');
        const response = await api.get('/auth/check-auth');
        console.log('Auth check response:', response.data);
        
        if (isMounted && response.data) {
          setUser(response.data);
          localStorage.setItem('user', JSON.stringify(response.data));
        }
      } catch (error) {
        console.error("Auth verification failed:", error);
        
        if (isMounted) {
          // Only redirect to login if we're on a protected page
          const currentPath = window.location.pathname;
          const nonAuthPaths = ['/login', '/signup', '/'];
          
          if (!nonAuthPaths.includes(currentPath)) {
            console.log('Redirecting to /login due to auth failure');
            navigate('/login');
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    verifyUser();
    
    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const login = async (email, password) => {
    try {
      console.log('Attempting login for:', email);
      
      const response = await api.post('/auth/login', { email, password });
      console.log('Login successful:', response.data);
      
      setUser(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
      
      // Verify authentication immediately after login
      try {
        const verifyResponse = await api.get('/auth/check-auth');
        console.log('Auth verified after login:', verifyResponse.data);
      } catch (verifyError) {
        console.warn('Auth verification after login failed:', verifyError);
      }
      
      navigate("/chat");
      return response.data;
    } catch (error) {
      console.error("Login failed:", error);
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const signup = async (name, email, password) => {
    try {
      console.log('Attempting signup for:', email);
      
      const response = await api.post('/auth/signup', { name, email, password });
      console.log('Signup successful:', response.data);
      
      setUser(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
      
      navigate("/chat");
      return response.data;
    } catch (error) {
      console.error("Signup failed:", error);
      throw new Error(error.response?.data?.message || 'Signup failed');
    }
  };

  const logout = async () => {
    try {
      console.log('Attempting logout');
      await api.post('/auth/logout');
      
      setUser(null);
      localStorage.removeItem('user');
      
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      
      // Still clear user data even if the API call fails
      setUser(null);
      localStorage.removeItem('user');
      navigate("/login");
    }
  };

  const checkAuthStatus = async () => {
    try {
      console.log('Manual auth status check');
      const response = await api.get('/auth/check-auth');
      
      setUser(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
      
      return response.data;
    } catch (error) {
      console.error("Manual auth check failed:", error);
      
      setUser(null);
      localStorage.removeItem('user');
      
      throw error;
    }
  };

  const signInWithGoogle = () => {
    console.log('Initiating Google sign-in');
    localStorage.setItem('intendedPath', window.location.pathname === '/login' ? '/chat' : window.location.pathname);
    window.location.href = `${API_URL}/auth/google`;
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
        api // Expose the api instance for use in other components
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