import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const SystemContext = createContext();

export const useSystem = () => useContext(SystemContext);

export const SystemProvider = ({ children }) => {
    const [sistemaConfig, setSistemaConfig] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await axios.get('/api/sistema-config');
                if (res.data.success && res.data.data) {
                    let config = res.data.data;

                    // --- Lógica de Color Dinámica ---
                    let primaryColor = '#1976d2'; // Default MUI
                    if (config.theme) {
                        const match = config.theme.match(/--primary-color:\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\)|hsl\([^)]+\))/);
                        if (match) primaryColor = match[1].trim();
                    }

                    // Función para mezclar colores (sacar promedio con peso)
                    const mixColors = (color1, color2, weight) => {
                        const d2h = (d) => ('0' + d.toString(16)).slice(-2);
                        const parse = (c) => {
                            let hex = c.replace('#', '');
                            if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
                            return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
                        };
                        const c1 = parse(color1);
                        const c2 = parse(color2);
                        const r = Math.round(c1[0] * weight + c2[0] * (1 - weight));
                        const g = Math.round(c1[1] * weight + c2[1] * (1 - weight));
                        const b = Math.round(c1[2] * weight + c2[2] * (1 - weight));
                        return `#${d2h(r)}${d2h(g)}${d2h(b)}`;
                    };

                    // Función para aclarar/oscurecer (Simple Hex/RGB)
                    const adjustColor = (hex, amount) => {
                        let color = hex.replace('#', '');
                        if (color.length === 3) color = color.split('').map(c => c + c).join('');
                        const num = parseInt(color, 16);
                        let r = (num >> 16) + amount;
                        let g = ((num >> 8) & 0x00FF) + amount;
                        let b = (num & 0x0000FF) + amount;
                        r = Math.min(255, Math.max(0, r));
                        g = Math.min(255, Math.max(0, g));
                        b = Math.min(255, Math.max(0, b));
                        return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
                    };

                    // Calcular Luminancia para contraste
                    const getLuminance = (hex) => {
                        let color = hex.replace('#', '');
                        if (color.length === 3) color = color.split('').map(c => c + c).join('');
                        const r = parseInt(color.substring(0, 2), 16) / 255;
                        const g = parseInt(color.substring(2, 4), 16) / 255;
                        const b = parseInt(color.substring(4, 6), 16) / 255;
                        const a = [r, g, b].map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
                        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
                    };

                    // Generar variables automáticas: Fondo Menú como "promedio" (10% color primario, 90% blanco)
                    const fondoMenu = mixColors(primaryColor, '#ffffff', 0.08); // Tintado sutil
                    const isDarkMenu = getLuminance(fondoMenu) < 0.5;
                    // Letra Menú: Blanco si es oscuro, o versión muy oscura del primario si es claro
                    const letraMenu = isDarkMenu ? '#ffffff' : mixColors(primaryColor, '#000000', 0.4);

                    // Calcular fondo de login profesional
                    const secondaryColor = adjustColor(primaryColor, -40);
                    const tertiaryColor = adjustColor(primaryColor, -80);
                    const dynamicLoginBg = `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 50%, ${tertiaryColor} 100%)`;

                    // Inyectar variables calculadas al theme refuerzo (sobrescribir si existen)
                    let cleanTheme = config.theme || ':root {}';

                    // Remover las variables si ya existen para que la versión calculada gane
                    cleanTheme = cleanTheme.replace(/--fondo-menu:\s*[^;]+;/g, '').replace(/--letra-menu:\s*[^;]+;/g, '');

                    // Insertar nuevas variables en el :root
                    let fullTheme = cleanTheme.replace(':root {', `:root {\n    --fondo-menu: ${fondoMenu};\n    --letra-menu: ${letraMenu};`);

                    const updatedConfig = {
                        ...config,
                        theme: fullTheme,
                        login_bg: config.login_bg || dynamicLoginBg
                    };

                    setSistemaConfig(updatedConfig);

                    // Aplicar título de la pestaña del navegador
                    if (config.titulo) {
                        document.title = config.titulo;
                    }

                    // Aplicar favicon dinámico sincronizado con el color primario
                    const generateFavicon = (color) => {
                        // SVG Transparente (solo el icono en color primario)
                        const svg = `
                            <svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22>
                                <path d=%22M20 50 Q50 10 80 50 T20 50 Z%22 fill=%22${encodeURIComponent(color)}%22 opacity=%220.6%22/>
                                <circle cx=%2250%22 cy=%2250%22 r=%2240%22 fill=%22none%22 stroke=%22${encodeURIComponent(color)}%22 stroke-width=%2210%22 opacity=%221%22/>
                                <path d=%22M50 10 L50 90 M10 50 L90 50%22 stroke=%22${encodeURIComponent(color)}%22 stroke-width=%226%22 opacity=%220.4%22/>
                            </svg>
                        `.trim().replace(/\s+/g, ' ');
                        return `data:image/svg+xml,${svg}`;
                    };

                    const faviconUrl = config.icono || generateFavicon(primaryColor);
                    const iconLinks = document.querySelectorAll("link[rel*='icon']");
                    if (iconLinks.length > 0) {
                        iconLinks.forEach(link => {
                            link.href = faviconUrl;
                            if (faviconUrl.startsWith('data:image/svg')) link.type = 'image/svg+xml';
                        });
                    } else {
                        const newLink = document.createElement('link');
                        newLink.rel = 'icon';
                        newLink.href = faviconUrl;
                        if (faviconUrl.startsWith('data:image/svg')) newLink.type = 'image/svg+xml';
                        document.head.appendChild(newLink);
                    }

                    // Aplicar theme dinámico (CSS variables desde la BD + Calculadas)
                    const styleId = 'ghenesis-dynamic-theme';
                    let styleEl = document.getElementById(styleId);
                    if (styleEl) styleEl.remove(); // Remanufacturarlo al fondo para prioridad

                    styleEl = document.createElement('style');
                    styleEl.id = styleId;
                    styleEl.textContent = fullTheme;
                    document.head.appendChild(styleEl);
                }
            } catch (error) {
                console.error('Error cargando configuración del sistema:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, []);

    return (
        <SystemContext.Provider value={{ sistemaConfig, loading }}>
            {children}
        </SystemContext.Provider>
    );
};
