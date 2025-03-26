import { createContext, useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext();

const API_URL = import.meta.env.VITE_BACKEND_URL || 'https://vanni-test-backend.vercel.app';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = sessionStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchWithCredentials = async (endpoint, options = {}) => {
    const defaultOptions = {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      ...options,
    };

    try {
      console.log(`Fetching ${endpoint} with credentials`);
      const response = await fetch(`${API_URL}${endpoint}`, defaultOptions);
      console.log(`Response from ${endpoint}: Status ${response.status}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
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
      console.error(`FetchWithCredentials error for ${endpoint}:`, error.stack);
      throw error;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const verifyUser = async () => {
      try {
        console.log('Verifying user authentication');
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
              sessionStorage.setItem('user', JSON.stringify(userData));
              setLoading(false);
              window.history.replaceState({}, document.title, '/chat');
              navigate('/chat');
              return;
            }
          } else {
            console.error("No user data in Google auth redirect");
          }
        }

        const error = urlParams.get('error');
        if (error === 'auth_failed') {
          console.error('Google authentication failed');
          if (isMounted) {
            setUser(null);
            sessionStorage.removeItem('user');
            setLoading(false);
            navigate('/login');
          }
          return;
        }

        console.log('Checking auth status with /auth/check-auth');
        const response = await fetchWithCredentials('/auth/check-auth');
        const data = await response.json();
        console.log('Auth check response:', data);

        if (isMounted) {
          setUser(data);
          sessionStorage.setItem('user', JSON.stringify(data));
          setLoading(false);
          const intendedPath = localStorage.getItem('intendedPath');
          if (intendedPath && intendedPath !== window.location.pathname) {
            localStorage.removeItem('intendedPath');
            navigate(intendedPath);
          }
        }
      } catch (error) {
        console.error("Auth verification failed:", error.stack);
        if (isMounted) {
          setLoading(false);
          const currentPath = window.location.pathname;
          const nonAuthPaths = ['/login', '/signup', '/'];
          if (!nonAuthPaths.includes(currentPath)) {
            console.log('Redirecting to /login due to auth failure');
            navigate('/login');
          }
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
      console.log('Manual auth status check');
      const response = await fetchWithCredentials('/auth/check-auth');
      const data = await response.json();
      setUser(data);
      sessionStorage.setItem('user', JSON.stringify(data));
      return data;
    } catch (error) {
      console.error("Manual auth check failed:", error.stack);
      setUser(null);
      sessionStorage.removeItem('user');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      console.log('Attempting login for:', email);
      const response = await fetchWithCredentials('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      console.log('Login successful:', data);
      setUser(data);
      sessionStorage.setItem('user', JSON.stringify(data));
      navigate("/chat");
      return data;
    } catch (error) {
      console.error("Login failed:", error.stack);
      throw new Error(error.message || 'Login failed');
    }
  };

  const signup = async (name, email, password) => {
    try {
      console.log('Attempting signup for:', email);
      const response = await fetchWithCredentials('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      console.log('Signup successful:', data);
      setUser(data);
      sessionStorage.setItem('user', JSON.stringify(data));
      navigate("/chat");
      return data;
    } catch (error) {
      console.error("Signup failed:", error.stack);
      throw new Error(error.message || 'Signup failed');
    }
  };

  const logout = async () => {
    try {
      console.log('Attempting logout');
      await fetchWithCredentials('/auth/logout', { method: 'POST' });
      setUser(null);
      sessionStorage.removeItem('user');
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error.stack);
    }
  };

  const signInWithGoogle = () => {
    console.log('Initiating Google sign-in');
    localStorage.setItem('intendedPath', window.location.pathname === '/login' ? '/chat' : window.location.pathname);
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