import { createContext, useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext();

const API_URL = import.meta.env.VITE_BACKEND_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  if (!API_URL) {
    console.error('VITE_BACKEND_URL is required in environment variables');
  }

  const fetchWithCredentials = async (endpoint, options = {}) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      ...options
    });

    if (!response.ok) {
      const data = await response.text();
      if (response.status === 401) {
        setUser(null);
        localStorage.removeItem('user');
        sessionStorage.removeItem('user');
      }
      throw new Error(`HTTP error! status: ${response.status} - ${data}`);
    }
    return response;
  };

  useEffect(() => {
    let isMounted = true;

    const verifyUser = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const googleAuth = urlParams.get('auth') === 'google';

        if (googleAuth) {
          const userInfo = urlParams.get('user');
          if (userInfo) {
            const userData = JSON.parse(decodeURIComponent(userInfo));
            if (isMounted) {
              setUser(userData);
              localStorage.setItem('user', JSON.stringify(userData));
              sessionStorage.setItem('user', JSON.stringify(userData));
              setLoading(false);
              window.history.replaceState({}, document.title, '/chat');
              navigate('/chat');
              return;
            }
          }
        }

        const error = urlParams.get('error');
        if (error === 'auth_failed') {
          if (isMounted) {
            setUser(null);
            setLoading(false);
            navigate('/login');
          }
          return;
        }

        const response = await fetchWithCredentials('/auth/check-auth');
        const data = await response.json();
        
        if (isMounted) {
          setUser(data);
          localStorage.setItem('user', JSON.stringify(data));
          sessionStorage.setItem('user', JSON.stringify(data));
          setLoading(false);
        }
      } catch (error) {
        console.error("Auth verification failed:", error);
        if (isMounted) {
          setUser(null);
          localStorage.removeItem('user');
          sessionStorage.removeItem('user');
          setLoading(false);
          if (!['/login', '/signup', '/'].includes(window.location.pathname)) {
            navigate('/login');
          }
        }
      }
    };

    verifyUser();
    return () => { isMounted = false; };
  }, [navigate]);

  const login = async (email, password) => {
    try {
      const response = await fetchWithCredentials('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      setUser(data);
      localStorage.setItem('user', JSON.stringify(data));
      sessionStorage.setItem('user', JSON.stringify(data));
      navigate("/chat");
      return data;
    } catch (error) {
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
      localStorage.setItem('user', JSON.stringify(data));
      sessionStorage.setItem('user', JSON.stringify(data));
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
      localStorage.removeItem('user');
      sessionStorage.removeItem('user');
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const signInWithGoogle = () => {
    localStorage.setItem('intendedPath', '/chat');
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