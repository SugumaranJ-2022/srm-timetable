import React, { createContext, useState, useEffect, useContext } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const data = await authApi.getProfile();
      setUser(data.user);
      setRole(data.user.role);
      setProfile(data);
    } catch (error) {
      console.error('Failed to load profile', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (credentials, passwordArg) => {
    setLoading(true);
    try {
      let data;
      if (typeof credentials === 'object' && credentials !== null) {
        data = await authApi.login(credentials);
      } else {
        data = await authApi.login({ email: credentials, password: passwordArg });
      }

      if (data.mfa_required) {
        setLoading(false);
        return data;
      }

      if (data.access_token) {
        localStorage.setItem('token', data.access_token);
        await fetchProfile();
      }
      return data;
    } catch (error) {
      console.error('Login error', error);
      setLoading(false);
      throw error;
    }
  };

  const verifyMfa = async ({ mfa_token, code }) => {
    setLoading(true);
    try {
      const data = await authApi.verifyMfa({ mfa_token, code });
      if (data.access_token) {
        localStorage.setItem('token', data.access_token);
        await fetchProfile();
      }
      return data;
    } catch (error) {
      console.error('MFA verify error', error);
      setLoading(false);
      throw error;
    }
  };

  const loginWithToken = async (accessToken) => {
    setLoading(true);
    try {
      localStorage.setItem('token', accessToken);
      await fetchProfile();
    } catch (err) {
      console.error('Login with token error', err);
      setLoading(false);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setRole(null);
    setProfile(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, role, profile, loading, login, loginWithToken, verifyMfa, logout, refreshProfile: fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
