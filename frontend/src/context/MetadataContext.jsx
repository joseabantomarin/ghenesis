import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

// Equivalente al 'dframe' de Delphi adaptado para JS/React
const MetadataContext = createContext();

export const useMetadata = () => useContext(MetadataContext);

export const MetadataProvider = ({ children }) => {
    const { token } = useAuth();
    const [menu, setMenu] = useState([]);
    const [formsCache, setFormsCache] = useState({});
    const [loadingMenu, setLoadingMenu] = useState(true);

    // Al inicio, solo cargamos los forms que servirán de Menú (requiere token)
    useEffect(() => {
        if (!token) {
            setLoadingMenu(false);
            return;
        }
        const fetchMenu = async () => {
            try {
                const res = await axios.get('/api/dynamic/menu');
                if (res.data.success) {
                    setMenu(res.data.data);
                }
            } catch (error) {
                console.error("Error fetching menu metadata", error);
            } finally {
                setLoadingMenu(false);
            }
        };
        setLoadingMenu(true);
        fetchMenu();
    }, [token]);

    // Función para obtener la definición de un módulo específico (XFORM + XGRID + XCONTROLS)
    // Utiliza caché en memoria para "no demorar la próxima vez que se lo llama"
    const getFormDefinition = async (idform) => {
        if (formsCache[idform]) {
            return formsCache[idform];
        }

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

    // Ejecutor de Scripts en el Servidor (Sactivate, etc)
    const runFormEvent = async (idform, eventName, contextParams = {}) => {
        try {
            const res = await axios.post(`/api/dynamic/run/${idform}/${eventName}`, contextParams);
            if (res.data.success && res.data.data) {
                return res.data.data; // Lo devuelto por el Sandbox
            }
        } catch (error) {
            console.error(`Error executing Server Script ${eventName} on ${idform}`, error);
        }
        return null; // Si no hay script o falla, retorna silencioso
    };

    return (
        <MetadataContext.Provider value={{
            menu,
            loadingMenu,
            getFormDefinition,
            runFormEvent
        }}>
            {children}
        </MetadataContext.Provider>
    );
};
