import { createContext, useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const AuthContext = createContext();

const API_URL = import.meta.env.VITE_BACKEND_URL || 'https://vanni-test-backend.vercel.app';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  
  const [token, setToken] = useState(() => {
    return localStorage.getItem('authToken') || null;
  });
  
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  // Create an axios instance that will include the token in every request
  const api = axios.create({
    baseURL: API_URL,
    withCredentials: true // Still include cookies just in case
  });
  
  // Set up axios interceptor to add the token to all requests
  useEffect(() => {
    const requestInterceptor = api.interceptors.request.use(
      (config) => {
        console.log("Making request to:", config.url);
        
        // Add token to headers if available
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
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
          console.log("401 Unauthorized detected, clearing auth state");
          setUser(null);
          setToken(null);
          localStorage.removeItem('user');
          localStorage.removeItem('authToken');
        }
        
        return Promise.reject(error);
      }
    );
    
    return () => {
      // Clean up interceptors when component unmounts
      api.interceptors.request.eject(requestInterceptor);
      api.interceptors.response.eject(responseInterceptor);
    };
  }, [token]);
  
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
          const urlToken = urlParams.get('token');
          
          if (urlUser && urlToken) {
            const userData = JSON.parse(decodeURIComponent(urlUser));
            if (isMounted) {
              console.log('Setting user from Google auth:', userData);
              setUser(userData);
              setToken(urlToken);
              localStorage.setItem('user', JSON.stringify(userData));
              localStorage.setItem('authToken', urlToken);
              setLoading(false);
              
              // Clean up URL parameters
              window.history.replaceState({}, document.title, '/chat');
              navigate('/chat');
              return;
            }
          }
        }
        
        // Check if we have a token to validate
        if (!token) {
          console.log('No token found, user is not authenticated');
          setLoading(false);
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
          // Clear auth state on verification failure
          setUser(null);
          setToken(null);
          localStorage.removeItem('user');
          localStorage.removeItem('authToken');
          
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
  }, [navigate, token]);
  
  const login = async (email, password) => {
    try {
      console.log('Attempting login for:', email);
      
      const response = await axios.post(`${API_URL}/auth/login`, { email, password }, {
        withCredentials: true
      });
      
      console.log('Login response:', response);
      
      // Get token from response header or data
      const authToken = response.headers['x-auth-token'] || response.data.token;
      
      if (!authToken) {
        console.error('No token received in login response');
        throw new Error('Authentication failed - no token received');
      }
      
      console.log('Login successful, token received');
      
      // Save token and user data
      setToken(authToken);
      setUser(response.data);
      
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('user', JSON.stringify(response.data));
      
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
      
      const response = await axios.post(`${API_URL}/auth/signup`, 
        { name, email, password }, 
        { withCredentials: true }
      );
      
      // Get token from response header or data
      const authToken = response.headers['x-auth-token'] || response.data.token;
      
      if (!authToken) {
        console.error('No token received in signup response');
        throw new Error('Authentication failed - no token received');
      }
      
      console.log('Signup successful, token received');
      
      // Save token and user data
      setToken(authToken);
      setUser(response.data);
      
      localStorage.setItem('authToken', authToken);
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
    } catch (error) {
      console.error("Logout API call failed:", error);
    } finally {
      // Always clear local auth state regardless of API success
      setUser(null);
      setToken(null);
      localStorage.removeItem('user');
      localStorage.removeItem('authToken');
      navigate("/login");
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
        token,
        loading,
        login,
        signup,
        logout,
        signInWithGoogle,
        api
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