import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const MetadataContext = createContext();

export const useMetadata = () => useContext(MetadataContext);

export const MetadataProvider = ({ children }) => {
    const { token, user } = useAuth();
    const [menu, setMenu] = useState([]);
    const [formsCache, setFormsCache] = useState({});
    const [permissions, setPermissions] = useState({}); // { idform: { readonly, hidden } }
    const [loadingMenu, setLoadingMenu] = useState(true);

    // Cargar menú y permisos cuando hay token
    useEffect(() => {
        if (!token) {
            setLoadingMenu(false);
            return;
        }
        const fetchData = async () => {
            try {
                // Cargar menú y permisos en paralelo
                const [menuRes, permRes] = await Promise.all([
                    axios.get('/api/dynamic/menu'),
                    axios.get('/api/auth/permissions')
                ]);

                if (menuRes.data.success) {
                    setMenu(menuRes.data.data);
                }
                if (permRes.data.success) {
                    setPermissions(permRes.data.data);
                }
            } catch (error) {
                // Silencioso en producción
            } finally {
                setLoadingMenu(false);
            }
        };
        setLoadingMenu(true);
        fetchData();
    }, [token]);

    // Función para obtener la definición de un módulo específico
    const getFormDefinition = async (idform) => {
        // Eliminado chequeo de caché local para que siempre se evalúen los metadatos fresh al ingresar
        try {
            const res = await axios.get(`/api/dynamic/meta/${idform}`);
            if (res.data.success) {
                setFormsCache(prev => ({ ...prev, [idform]: res.data.data }));
                return res.data.data;
            }
        } catch (error) {
            console.error(`Error fetching meta for ${idform}`, error);
        }
        return null;
    };

    // Ejecutor de Scripts en el Servidor
    const runFormEvent = async (idform, eventName, contextParams = {}) => {
        try {
            const res = await axios.post(`/api/dynamic/run/${idform}/${eventName}`, contextParams);
            if (res.data.success && res.data.data) {
                return res.data.data;
            }
        } catch (error) {
            console.error(`Error executing Server Script ${eventName} on ${idform}`, error);
        }
        return null;
    };

    return (
        <MetadataContext.Provider value={{
            menu,
            loadingMenu,
            permissions,
            getFormDefinition,
            runFormEvent
        }}>
            {children}
        </MetadataContext.Provider>
    );
};
