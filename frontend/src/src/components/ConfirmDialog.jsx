import React, { useRef, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Typography, Box, Zoom, IconButton
} from '@mui/material';
import { Warning as WarningIcon, Close as CloseIcon } from '@mui/icons-material';

const Transition = React.forwardRef(function Transition(props, ref) {
    return <Zoom ref={ref} {...props} />;
});

/**
 * ConfirmDialog – Diálogo profesional de confirmación con animación Zoom.
 *
 * Props:
 *  - open       : boolean – controla la visibilidad
 *  - title      : string  – título del diálogo (default: "Confirmar acción")
 *  - message    : string  – texto descriptivo
 *  - onConfirm  : () => void – callback al aceptar
 *  - onCancel   : () => void – callback al cancelar / cerrar
 *  - confirmText: string (default "Aceptar")
 *  - cancelText : string (default "Cancelar")
 */
const ConfirmDialog = ({
    open,
    title = 'Confirmar acción',
    message = '¿Estás seguro de que deseas continuar?',
    onConfirm,
    onCancel,
    confirmText = 'Aceptar',
    cancelText = 'Cancelar'
}) => {
    const cancelRef = useRef(null);

    // Auto-focus en "Cancelar" al abrir para evitar confirmaciones accidentales
    useEffect(() => {
        if (open) {
            // Pequeño timeout para que el Zoom termine de montar el DOM
            const t = setTimeout(() => cancelRef.current?.focus(), 150);
            return () => clearTimeout(t);
        }
    }, [open]);

    // Soporte teclado: Enter confirma, Escape cancela (Escape ya lo maneja MUI)
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onConfirm?.();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onCancel}
            TransitionComponent={Transition}
            transitionDuration={280}
            onKeyDown={handleKeyDown}
            PaperProps={{
                sx: {
                    borderRadius: '16px',
                    minWidth: { xs: '88vw', sm: 420 },
                    maxWidth: 480,
                    overflow: 'hidden',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
                }
            }}
            slotProps={{
                backdrop: {
                    sx: {
                        backgroundColor: 'rgba(0,0,0,0.45)',
                        backdropFilter: 'blur(4px)',
                    }
                }
            }}
        >
            {/* Cabecera con icono de advertencia */}
            <DialogTitle
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    bgcolor: 'var(--primary-color)',
                    color: 'var(--primary-text-color)',
                    py: 1.8,
                    px: 2.5,
                    position: 'relative',
                }}
            >
                {/* Icono animado */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'rgba(255,255,255,0.2)',
                        borderRadius: '50%',
                        width: 40,
                        height: 40,
                        flexShrink: 0,
                        animation: open ? 'confirm-pulse 1.8s ease-in-out infinite' : 'none',
                        '@keyframes confirm-pulse': {
                            '0%, 100%': { transform: 'scale(1)', opacity: 1 },
                            '50%': { transform: 'scale(1.12)', opacity: 0.85 },
                        },
                    }}
                >
                    <WarningIcon sx={{ fontSize: 24, color: 'var(--primary-text-color)' }} />
                </Box>

                <Typography
                    component="span"
                    sx={{
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        letterSpacing: '0.02em',
                        flex: 1,
                    }}
                >
                    {title}
                </Typography>

                {/* Botón de cierre (X) */}
                <IconButton
                    aria-label="cerrar"
                    onClick={onCancel}
                    sx={{
                        color: 'var(--primary-text-color)',
                        opacity: 0.8,
                        '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.15)' },
                    }}
                    size="small"
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            {/* Contenido */}
            <DialogContent sx={{ py: 3, px: 3 }}>
                <Typography
                    sx={{
                        fontSize: '0.97rem',
                        lineHeight: 1.65,
                        color: 'text.secondary',
                        mt: 1,
                    }}
                >
                    {message}
                </Typography>
            </DialogContent>

            {/* Botones de acción */}
            <DialogActions
                sx={{
                    px: 3,
                    pb: 2.5,
                    pt: 0,
                    gap: 1.5,
                }}
            >
                <Button
                    ref={cancelRef}
                    onClick={onCancel}
                    disableFocusRipple
                    variant="outlined"
                    sx={{
                        borderRadius: '10px',
                        textTransform: 'none',
                        fontWeight: 600,
                        px: 3,
                        py: 0.9,
                        borderColor: '#ccc',
                        color: 'text.secondary',
                        '&:hover': {
                            borderColor: '#999',
                            bgcolor: '#f5f5f5',
                        },
                    }}
                >
                    {cancelText}
                </Button>

                <Button
                    onClick={onConfirm}
                    disableFocusRipple
                    variant="contained"
                    color="error"
                    sx={{
                        borderRadius: '10px',
                        textTransform: 'none',
                        fontWeight: 600,
                        px: 3,
                        py: 0.9,
                        boxShadow: '0 4px 14px rgba(211,47,47,0.3)',
                        '&:hover': {
                            boxShadow: '0 6px 20px rgba(211,47,47,0.4)',
                        },
                    }}
                >
                    {confirmText}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmDialog;
