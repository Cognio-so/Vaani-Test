import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../utils/api'; // Import the API utility

const AuthCallback = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  
  useEffect(() => {
    const processAuth = async () => {
      try {
        // Get token from URL
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        if (token) {
          // Store token
          localStorage.setItem('access_token', token);
          
          // Fetch user profile with token using our API utility
          const response = await api.get('/auth/profile');
          
          if (response.data) {
            setUser(response.data);
          }
          
          // Navigate to chat
          navigate('/chat');
        } else {
          // No token, redirect to login
          navigate('/login');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/login');
      }
    };
    
    processAuth();
  }, [navigate, setUser]);
  
  return <LoadingSpinner />;
};

export default AuthCallback; 