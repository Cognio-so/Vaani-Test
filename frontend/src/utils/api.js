import axios from 'axios';

const backend_url = import.meta.env.VITE_BACKEND_URL;

// Create axios instance with default config
const api = axios.create({
  baseURL: backend_url,
  withCredentials: true,
  timeout: 30000, // 30 second timeout
});

// Request interceptor to add auth token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh on 401 errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and we haven't tried to refresh token yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh the token
        const response = await axios.post(`${backend_url}/auth/refresh-token`, {}, {
          withCredentials: true
        });
        
        if (response.data.token) {
          // Save the new token
          localStorage.setItem('access_token', response.data.token);
          
          // Update the original request with new token
          originalRequest.headers.Authorization = `Bearer ${response.data.token}`;
          
          // Retry the original request with new token
          return axios(originalRequest);
        }
      } catch (refreshError) {
        // Only clear the token, but DON'T redirect
        localStorage.removeItem('access_token');
      }
    }
    
    return Promise.reject(error);
  }
);

export default api; 