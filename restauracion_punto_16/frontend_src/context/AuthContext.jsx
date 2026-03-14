import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            checkSession();
        } else {
            setLoading(false);
        }
    }, [token]);

    const checkSession = async () => {
        try {
            const res = await axios.get('/api/auth/me');
            if (res.data.success) {
                setUser(res.data.user);
            } else {
                logout();
            }
        } catch (error) {
            console.error('Session check failed', error);
            logout();
        } finally {
            setLoading(false);
        }
    };

    const login = async (username, password) => {
        try {
            const res = await axios.post('/api/auth/login', { username, password });
            if (res.data.success) {
                const newToken = res.data.token;
                localStorage.setItem('token', newToken);
                setToken(newToken);
                setUser(res.data.user);
                axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
                return { success: true };
            }
            return { success: false, error: res.data.error };
        } catch (error) {
            return { success: false, error: error.response?.data?.error || 'Error de conexión' };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        delete axios.defaults.headers.common['Authorization'];
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
