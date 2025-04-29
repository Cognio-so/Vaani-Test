import { createContext, useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext();

const API_URL = import.meta.env.VITE_BACKEND_URL

export const AuthProvider = ({ children }) => {
  // Initialize user state without sessionStorage
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchWithCredentials = async (endpoint, options = {}) => {
    // Get token from localStorage as fallback
    const token = localStorage.getItem('access_token');
    
    const defaultOptions = {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        // Add Authorization header as fallback if token exists
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      ...options
    };

    
    try {
      const response = await fetch(`${API_URL}${endpoint}`, defaultOptions);
      
    
      
      if (!response.ok) {
        const data = await response.text();
        console.error('Response error:', response.status, data);
        
        // Handle expired access token (attempt token refresh)
        if (response.status === 401) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            // Retry the original request with new access token
            const retryOptions = {
              ...defaultOptions,
              headers: {
                ...defaultOptions.headers,
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
              }
            };
            const retryResponse = await fetch(`${API_URL}${endpoint}`, retryOptions);
            if (retryResponse.ok) {
              return retryResponse;
            }
          }
          
          // If refresh failed or retry failed, clear user state
          setUser(null);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
        
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response;
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  };
  
  // New function to refresh access token
  const refreshAccessToken = async () => {
    try {
      // Direct fetch to avoid recursion with fetchWithCredentials
      const response = await fetch(`${API_URL}/auth/refresh-token`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      
      // Save new access token to localStorage
      if (data.token) {
        localStorage.setItem('access_token', data.token);
      }
      
      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;
    let ignoreRedirects = false;
    
    const verifyUser = async () => {
      try {
        // Check if we're returning from Google auth
        const urlParams = new URLSearchParams(window.location.search);
        const googleAuth = urlParams.get('auth') === 'google';
        const googleAuthInProgress = localStorage.getItem('googleAuthInProgress');
        
        if (googleAuth) {
          ignoreRedirects = true;
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
              if (isMounted) {
                setUser(userData);
                setLoading(false);
                
                // Save token to localStorage if available
                if (urlToken) {
                  localStorage.setItem('access_token', urlToken);
                }
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
          if (isMounted) setUser(null);
          if (isMounted) setLoading(false);
          navigate('/login');
          return;
        }

        const response = await fetchWithCredentials('/auth/check-auth');
        const data = await response.json();
        
        if (isMounted) {
          setUser(data);
          setLoading(false);
        }
        
        // Only handle redirects if not ignoring them
        if (!ignoreRedirects && !googleAuth) {
          const intendedPath = localStorage.getItem('intendedPath');
          if (intendedPath) {
            localStorage.removeItem('intendedPath');
            navigate(intendedPath);
          }
        }
      } catch (error) {
        console.error("Auth verification failed:", error);
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
        
        // Only redirect if not ignoring redirects and not on non-auth paths
        const nonAuthPaths = ['/login', '/signup', '/'];
        if (!ignoreRedirects && !nonAuthPaths.includes(window.location.pathname)) {
          navigate('/login');
        }
      }
    };

    verifyUser();
    
    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const checkAuthStatus = async () => {
    try {
      const response = await fetchWithCredentials('/auth/check-auth');
      const data = await response.json();
      setUser(data);
    } catch (error) {
      console.error("Auth check failed:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetchWithCredentials('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      // Store token in localStorage if returned by backend
      if (data.token) {
        localStorage.setItem('access_token', data.token);
      }
      
      setUser({
        ...data,
        profilePicture: data.profilePicture
      });
      navigate("/chat");
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  };

  const signup = async (name, email, password) => {
    try {
      const response = await fetchWithCredentials('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });
      
      const data = await response.json();
      // Store token in localStorage if returned by backend
      if (data.token) {
        localStorage.setItem('access_token', data.token);
      }
      
      setUser(data);
      navigate("/chat");
      return data;
    } catch (error) {
      throw new Error(error.message || 'Signup failed');
    }
  };

  const logout = async () => {
    try {
      // Get the access token
      const token = localStorage.getItem('access_token');
      
      // Only make the logout request if we have a token
      if (token) {
        await fetchWithCredentials('/auth/logout', { 
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
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
      
      // Remove approval_prompt and just use prompt
      const timestamp = new Date().getTime();
      const googleAuthUrl = `${API_URL}/auth/google?` +
        `t=${timestamp}&` +
        `prompt=consent+select_account`;
      
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