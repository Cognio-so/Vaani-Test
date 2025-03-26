import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom'
import { useState, useEffect, createContext } from 'react'
import ChatPage from './pages/chatPage'
import SignupPage from './pages/SignupPage'
import LoginPage from './pages/LoginPage'
import Settings from './components/Settings'
import HomePage from './pages/Homepage'
import LoadingSpinner from './components/LoadingSpinner'
import { AuthProvider, useAuth } from './context/AuthContext'

// Create Theme Context
export const ThemeContext = createContext();

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { user, loading, checkAuthStatus } = useAuth();
  const [localLoading, setLocalLoading] = useState(true);
  const [hasUser, setHasUser] = useState(false);
  
  // Prevent navigation loops by checking URL parameters
  const [preventRedirect, setPreventRedirect] = useState(false);
  
  useEffect(() => {
    // Check if we're returning from Google auth
    const urlParams = new URLSearchParams(window.location.search);
    const googleAuth = urlParams.get('auth') === 'google';
    const token = urlParams.get('token');
    
    if (googleAuth || token) {
      setPreventRedirect(true);
      // Remove the parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Double-check user from sessionStorage as a safeguard
    const savedUser = sessionStorage.getItem('user');
    
    if (user) {
      setHasUser(true);
      sessionStorage.setItem('user', JSON.stringify(user));
      setLocalLoading(false);
    } else if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser && Object.keys(parsedUser).length > 0) {
          setHasUser(true);
          // Try to refresh auth status if we have a saved user but no current user
          checkAuthStatus();
        }
      } catch (e) {
        console.error("Error parsing saved user:", e);
        sessionStorage.removeItem('user');
      }
      setLocalLoading(false);
    } else {
      setHasUser(false);
      setLocalLoading(false);
    }
  }, [user, checkAuthStatus]);
  
  if (loading || localLoading) {
    return <LoadingSpinner /> 
  }
  
  
  if (!hasUser && !preventRedirect) {
    return <Navigate to="/login" />
  }
  
  return children;
}

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