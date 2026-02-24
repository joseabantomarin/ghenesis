import React, { useRef, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Typography, Box, Zoom, IconButton
} from '@mui/material';
import { ErrorOutline as ErrorIcon, Close as CloseIcon, InfoOutlined as InfoIcon } from '@mui/icons-material';

const Transition = React.forwardRef(function Transition(props, ref) {
    return <Zoom ref={ref} {...props} />;
});

/**
 * AlertDialog – Diálogo profesional para alertas y mensajes del sistema.
 * 
 * Props:
 *  - open    : boolean - visibilidad
 *  - title   : string  - título
 *  - message : string  - contenido
 *  - onClose : () => void - cierre
 *  - severity: 'error' | 'info' | 'warning' (default: 'error')
 */
const AlertDialog = ({
    open,
    title = 'Atención',
    message = '',
    onClose,
    severity = 'error'
}) => {
    const okRef = useRef(null);

    useEffect(() => {
        if (open) {
            const t = setTimeout(() => okRef.current?.focus(), 150);
            return () => clearTimeout(t);
        }
    }, [open]);

    const severityConfig = {
        error: {
            icon: <ErrorIcon sx={{ fontSize: 24, color: 'var(--primary-color)' }} />,
            shadow: 'rgba(0,0,0,0.1)'
        },
        warning: {
            icon: <ErrorIcon sx={{ fontSize: 24, color: '#ed6c02' }} />,
            shadow: 'rgba(0,0,0,0.1)'
        },
        info: {
            icon: <InfoIcon sx={{ fontSize: 24, color: 'var(--primary-color)' }} />,
            shadow: 'rgba(0,0,0,0.1)'
        }
    };

    const currentType = severityConfig[severity] || severityConfig.error;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            TransitionComponent={Transition}
            transitionDuration={280}
            PaperProps={{
                sx: {
                    borderRadius: '16px',
                    minWidth: { xs: '88vw', sm: 400 },
                    maxWidth: 450,
                    overflow: 'hidden',
                    boxShadow: '0 25px 70px rgba(0,0,0,0.22)',
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
            <DialogTitle
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    bgcolor: '#fff',
                    color: 'text.primary',
                    pb: 1,
                    pt: 2.5,
                    px: 3,
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'rgba(0,0,0,0.05)',
                        borderRadius: '12px',
                        width: 40,
                        height: 40,
                        flexShrink: 0,
                    }}
                >
                    {currentType.icon}
                </Box>

                <Typography component="span" sx={{ fontWeight: 800, fontSize: '1.15rem', flex: 1, color: 'var(--primary-color)' }}>
                    {title}
                </Typography>

                <IconButton
                    onClick={onClose}
                    sx={{ color: 'text.disabled', '&:hover': { color: 'text.primary', bgcolor: 'rgba(0,0,0,0.05)' } }}
                    size="small"
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ py: 2, px: 3 }}>
                <Typography sx={{ fontSize: '1.05rem', lineHeight: 1.6, color: 'text.secondary' }}>
                    {message}
                </Typography>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 3, pt: 1 }}>
                <Button
                    ref={okRef}
                    onClick={onClose}
                    variant="contained"
                    fullWidth
                    sx={{
                        bgcolor: 'var(--primary-color)',
                        color: 'var(--primary-text-color)',
                        borderRadius: '12px',
                        textTransform: 'none',
                        fontWeight: 700,
                        py: 1.2,
                        fontSize: '1rem',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        '&:hover': {
                            bgcolor: 'var(--primary-color)',
                            opacity: 0.9,
                            boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
                        },
                    }}
                >
                    Entendido
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AlertDialog;
