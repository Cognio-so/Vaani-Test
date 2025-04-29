import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom'
import { useState, useEffect, createContext } from 'react'
import ChatPage from './pages/chatPage'
import SignupPage from './pages/SignupPage'
import LoginPage from './pages/LoginPage'
import Settings from './components/Settings'
import HomePage from './pages/Homepage'
import CustomAgentPage from './pages/CustomAgentPage'
import LoadingSpinner from './components/LoadingSpinner'
import { AuthProvider, useAuth } from './context/AuthContext'

// Create Theme Context
export const ThemeContext = createContext();

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const [localLoading, setLocalLoading] = useState(true);
  const [hasUser, setHasUser] = useState(false);
  
  useEffect(() => {
    const checkAuth = async () => {
      // Check if returning from Google auth
      const urlParams = new URLSearchParams(window.location.search);
      const isGoogleAuth = urlParams.get('auth') === 'google';
      
      if (isGoogleAuth) {
        const userInfo = urlParams.get('user');
        const token = urlParams.get('token');
        if (userInfo && token) {
          try {
            const userData = JSON.parse(decodeURIComponent(userInfo));
            // Store token in localStorage
            localStorage.setItem('access_token', token);
            setHasUser(true);
            
            // Clear URL parameters to prevent refresh issues
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (error) {
            console.error('Error parsing Google auth user data:', error);
          }
        }
      } else if (user) {
        setHasUser(true);
      } else {
        // Check for token instead of saved user
        const accessToken = localStorage.getItem('access_token');
        if (accessToken) {
          setHasUser(true);
        }
      }
      setLocalLoading(false);
    };

    checkAuth();
  }, [user]);

  if (loading || localLoading) {
    return <LoadingSpinner />;
  }

  if (!hasUser) {
    return <Navigate to="/login" />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path='/' element={<HomePage />} />
      <Route path='/chat' element={
         <ProtectedRoute>
          <ChatPage />
         </ProtectedRoute>
      } />
      <Route path='/signup' element={<SignupPage />} />
      <Route path='/login' element={<LoginPage />} />
      <Route path='/custom-agent' element={
        <ProtectedRoute>
          <CustomAgentPage />
        </ProtectedRoute>
      } />
      <Route path='/settings' element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      } />
    </Routes>
  )
}

function App() {
  // Theme state with local storage persistence
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'dark';
  });

  // Update theme in localStorage and apply to document
  useEffect(() => {
    localStorage.setItem('theme', theme);
    
    // Apply theme class to the document body
    if (theme === 'light') {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    } else {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>  
      </Router>
    </ThemeContext.Provider>
  )
}

export default App