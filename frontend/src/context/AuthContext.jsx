import { createContext, useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext();

const API_URL = import.meta.env.VITE_BACKEND_URL || 'https://vanni-test-backend.vercel.app';

export const AuthProvider = ({ children }) => {
  // Initialize user from sessionStorage if available
  const [user, setUser] = useState(() => {
    const savedUser = sessionStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(!sessionStorage.getItem('user'));
  const navigate = useNavigate();

  const fetchWithCredentials = async (endpoint, options = {}) => {
    const defaultOptions = {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      ...options
    };

    try {
      console.log(`Fetching ${endpoint} with options:`, {
        ...defaultOptions,
        body: defaultOptions.body ? '[BODY CONTENT]' : undefined // Don't log sensitive data
      });
      
      const response = await fetch(`${API_URL}${endpoint}`, defaultOptions);
      console.log(`Response from ${endpoint}: Status ${response.status}`);
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: await response.text() || 'Unknown error' };
        }
        
        console.error(`Fetch error at ${endpoint}: ${response.status}`, errorData);
        
        if (response.status === 401) {
          console.log("401 Unauthorized detected, clearing user state");
          setUser(null);
          sessionStorage.removeItem('user');
        }
        
        throw new Error(`HTTP error! status: ${response.status} - ${errorData.message || 'No message'}`);
      }
      return response;
    } catch (error) {
      console.error(`FetchWithCredentials error for ${endpoint}:`, error);
      throw error;
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
        const googleAuthInProgress = sessionStorage.getItem('googleAuthInProgress');
        
        if (googleAuth) {
          ignoreRedirects = true;
          // Clear the Google auth in progress flag
          sessionStorage.removeItem('googleAuthInProgress');
          
          // Immediately clear URL parameters to prevent refresh issues
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // If we have URL user data, use it immediately
          const urlUser = urlParams.get('user');
          if (urlUser) {
            try {
              const userData = JSON.parse(decodeURIComponent(urlUser));
              if (isMounted) {
                setUser(userData);
                setLoading(false);
                sessionStorage.setItem('user', JSON.stringify(userData));
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
          
          // IMPORTANT: Store user in sessionStorage as a backup
          sessionStorage.setItem('user', JSON.stringify(data));
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
          // Clear backup user data
          sessionStorage.removeItem('user');
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
      console.log('Login successful, user data:', data);
      
      // Store user in state and sessionStorage
      setUser(data);
      sessionStorage.setItem('user', JSON.stringify(data));
      
      // Verify the cookie was set properly by making an immediate auth check
      try {
        console.log('Verifying authentication after login...');
        const verifyResponse = await fetchWithCredentials('/auth/check-auth');
        const verifyData = await verifyResponse.json();
        console.log('Authentication verified after login:', verifyData);
      } catch (verifyError) {
        console.error('Auth verification after login failed:', verifyError);
        // Continue despite error - user may still be logged in
      }
      
      navigate("/chat");
      return data;
    } catch (error) {
      console.error('Login failed:', error);
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
      setUser(data);
      navigate("/chat");
      return data;
    } catch (error) {
      throw new Error(error.message || 'Signup failed');
    }
  };

  const logout = async () => {
    try {
      await fetchWithCredentials('/auth/logout', { method: 'POST' });
      setUser(null);
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };
  
  const signInWithGoogle = () => {
    // Store the current path before redirecting to Google
    localStorage.setItem('intendedPath', window.location.pathname === '/login' ? '/chat' : window.location.pathname);
    // Set a flag to indicate we're starting Google auth flow
    sessionStorage.setItem('googleAuthInProgress', 'true');
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