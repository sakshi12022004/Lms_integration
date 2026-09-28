import { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { getStorageItem, setStorageItem, removeStorageItem, getBrowserInfo } from '../utils/browserCompatibility';

const AuthContext = createContext();

// Get API URL from environment or use default
const API = import.meta.env.VITE_BACKEND_URL || 'https://core5.io/api';

// Derive socket URL (strip trailing /api if present)
const SOCKET_URL = API.replace(/\/api\/?$/, '');

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    try {
      // Use compatibility utility for cross-browser support
      const storedToken = getStorageItem('token');
      return storedToken;
    } catch {
      return null;
    }
  });
  
  const [user, setUser] = useState(() => {
    try {
      // Use compatibility utility for cross-browser support
      const storedUser = getStorageItem('user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  // Validate existing tokens on mount
  useEffect(() => {
    const storedToken = getStorageItem('token');
    const storedUser = getStorageItem('user');
    
    const browserInfo = getBrowserInfo();
    console.log('Browser detected:', browserInfo.name, 'Storage available:', !!storedToken);
    
    // Only clear if token is invalid or user data is missing
    if (storedToken && !storedUser) {
      console.log('Clearing invalid token/user combo');
      removeStorageItem('token');
      removeStorageItem('user');
      setToken(null);
      setUser(null);
    } else if (storedToken && storedUser) {
      try {
        // Validate user data is proper JSON
        JSON.parse(storedUser);
        console.log('Token and user validation passed');
      } catch {
        console.log('Invalid user data format, clearing auth');
        removeStorageItem('token');
        removeStorageItem('user');
        setToken(null);
        setUser(null);
      }
    }
  }, []);

  // Initialize socket once
  const [socket, setSocket] = useState(null);
  useEffect(() => {
    try {
      const s = io({
        url: SOCKET_URL,
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true
      });
      setSocket(s);
      s.on('connect', () => console.log('Socket connected:', s.id));
      s.on('connect_error', (err) => console.warn('Socket connect_error', err.message));
      return () => {
        s.disconnect();
      };

    } catch (error) {
      console.error('Socket initialization error:', error);
    }
  }, []);

  const loginUser = (newToken, newUser) => {
    console.log('🔍 AuthContext loginUser called');
    console.log('🔍 AuthContext Setting token:', !!newToken);
    console.log('🔍 AuthContext Setting user:', newUser);
    
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    // Store userId explicitly for legacy components that read localStorage.userId
    try {
      const uid = newUser?.id || newUser?._id || newUser?.userId || '';
      if (uid) localStorage.setItem('userId', String(uid));
    } catch (e) {
      // ignore
    }
    
    console.log('🔍 AuthContext Token and user stored in localStorage');
    console.log('🔍 AuthContext Current user state after setting:', newUser);
  };

  const logoutUser = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ token, user, loginUser, logoutUser, API, socket }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
