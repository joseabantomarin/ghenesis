import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Select, MenuItem, FormControl,
    InputLabel, IconButton, Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

// CodeMirror 5 imports - Clásico y funcional
import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/eclipse.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/sql/sql';
import 'codemirror/mode/xml/xml';
import 'codemirror/mode/css/css';
import 'codemirror/mode/htmlmixed/htmlmixed';

// React Quill WYSIWYG
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

// ─── Tipo 1: Editor de Texto Plano ───
const PlainTextEditor = ({ value, onChange, onAccept }) => {
    const textRef = useRef(null);

    useEffect(() => {
        if (textRef.current) textRef.current.focus();
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            onAccept();
        }
    };

    return (
        <textarea
            ref={textRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
                width: '100%',
                height: '100%',
                resize: 'none',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: 14,
                padding: 12,
                border: '1px solid var(--grid-header-bg, #3c7a7d)',
                borderRadius: 4,
                backgroundColor: '#ffffff',
                color: '#1e1e1e',
                outline: 'none',
                lineHeight: 1.6,
                boxSizing: 'border-box'
            }}
        />
    );
};

// ─── Tipo 2: Editor de Código (CodeMirror 5) ───
const CodeEditor = ({ value, onChange, onAccept }) => {
    const editorContainerRef = useRef(null);
    const cmInstanceRef = useRef(null);
    const [language, setLanguage] = useState('javascript');
    const onAcceptRef = useRef(onAccept);
    const onChangeRef = useRef(onChange);

    onAcceptRef.current = onAccept;
    onChangeRef.current = onChange;

    // Inicializar CodeMirror por primera vez
    useEffect(() => {
        if (!editorContainerRef.current) return;

        const cm = CodeMirror(editorContainerRef.current, {
            value: value || '',
            mode: language === 'sql' ? 'text/x-sql' : language === 'html' ? 'text/html' : 'text/javascript',
            theme: 'eclipse',
            lineNumbers: true,
            lineWrapping: true,
            extraKeys: {
                'Ctrl-Enter': () => {
                    onAcceptRef.current();
                }
            }
        });

        cm.on('change', (instance) => {
            onChangeRef.current(instance.getValue());
        });

        cmInstanceRef.current = cm;

        // Retrasar focus para evadir animación de MUI
        setTimeout(() => {
            if (cmInstanceRef.current) {
                cmInstanceRef.current.focus();
                cmInstanceRef.current.refresh();
            }
        }, 150);

        return () => {
            // Limpiar
            const el = editorContainerRef.current;
            if (el) el.innerHTML = '';
            cmInstanceRef.current = null;
        };
    }, []); // Solo al montar

    // Actualizar configuración si cambia de lenguaje
    useEffect(() => {
        if (cmInstanceRef.current) {
            cmInstanceRef.current.setOption('mode', language === 'sql' ? 'text/x-sql' : language === 'html' ? 'text/html' : 'text/javascript');
        }
    }, [language]);

    // Sincronizar valor solo si el cambio viene desde afuera (prop 'value')
    useEffect(() => {
        if (cmInstanceRef.current) {
            const currentVal = cmInstanceRef.current.getValue();
            if (value !== currentVal && value !== undefined) {
                // Preservar la posición del cursor si es posible
                const cursor = cmInstanceRef.current.getCursor();
                cmInstanceRef.current.setValue(value);
                cmInstanceRef.current.setCursor(cursor);
            }
        }
    }, [value]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <Box sx={{ mt: 1, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <FormControl size="small" sx={{ minWidth: 120, '& .MuiInputBase-root': { height: 32 } }}>
                    <InputLabel sx={{ fontWeight: 'normal !important', fontSize: 13 }}>Lenguaje</InputLabel>
                    <Select value={language} label="Lenguaje" onChange={(e) => setLanguage(e.target.value)} sx={{ fontSize: 13 }}>
                        <MenuItem value="javascript">JavaScript</MenuItem>
                        <MenuItem value="sql">SQL</MenuItem>
                        <MenuItem value="html">HTML</MenuItem>
                    </Select>
                </FormControl>
                <Typography variant="caption" sx={{ color: '#8899aa' }}>
                    Ctrl+Enter para aceptar
                </Typography>
            </Box>
            <Box
                ref={editorContainerRef}
                sx={{
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    border: '1px solid var(--grid-header-bg, #3c7a7d)',
                    borderRadius: 1,
                    overflow: 'hidden',
                    minHeight: 0,
                    backgroundColor: '#fff',
                    '& .CodeMirror': {
                        flexGrow: 1,
                        height: '100%',
                        fontSize: '14px',
                        fontFamily: 'Consolas, Monaco, monospace'
                    }
                }}
            />
        </Box>
    );
};

// ─── Tipo 3: Editor WYSIWYG (Quill) ───
const WysiwygEditor = ({ value, onChange }) => {
    const modules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'indent': '-1' }, { 'indent': '+1' }],
            [{ 'align': [] }],
            ['blockquote', 'code-block'],
            ['link', 'image'],
            ['clean']
        ]
    };

    const [editorValue, setEditorValue] = useState(value || '');

    useEffect(() => {
        setEditorValue(value || '');
    }, [value]);

    return (
        <Box sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            '& .ql-container': { flexGrow: 1, fontSize: 14, display: 'flex', flexDirection: 'column' },
            '& .ql-editor': { flexGrow: 1 },
            '& .ql-toolbar': {
                borderRadius: '4px 4px 0 0',
                backgroundColor: 'var(--fondo-menu, #f1f6f7)',
                borderColor: 'var(--grid-header-bg, #3c7a7d)',
                flexShrink: 0
            },
            '& .ql-container.ql-snow': {
                borderRadius: '0 0 4px 4px',
                borderColor: 'var(--grid-header-bg, #3c7a7d)',
                borderBottom: 'none'
            }
        }}>
            <ReactQuill
                theme="snow"
                value={editorValue}
                onChange={(content) => {
                    setEditorValue(content);
                    onChange(content);
                }}
                modules={modules}
                style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
            />
        </Box>
    );
};

// ─── Dialog Principal ───
const MemoEditorDialog = ({ open, onClose, onAccept, initialValue, tipoMemo, fieldTitle }) => {
    const [content, setContent] = useState(initialValue || '');

    useEffect(() => {
        if (open) setContent(initialValue || '');
    }, [open, initialValue]);

    const handleAccept = () => {
        onAccept(content);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
        }
    };

    const dialogTitle = tipoMemo === 1 ? 'Editor de Texto' :
        tipoMemo === 2 ? 'Editor de Código' :
            tipoMemo === 3 ? 'Editor Visual (HTML)' : 'Editor';

    return (
        <Dialog
            open={open}
            onClose={onClose}
            onKeyDown={handleKeyDown}
            disableEnforceFocus
            disableAutoFocus
            disableRestoreFocus
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: {
                    height: '85vh',
                    maxHeight: '85vh',
                    display: 'flex',
                    flexDirection: 'column'
                }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                py: 1,
                px: 2,
                backgroundColor: 'var(--primary-color, #234e66)',
                color: 'var(--primary-text-color, #fff)',
                borderBottom: '3px solid var(--grid-header-bg, #3c7a7d)'
            }}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ color: 'inherit !important' }}>
                    {dialogTitle} — {fieldTitle}
                </Typography>
                <IconButton size="small" onClick={onClose} sx={{ color: 'inherit' }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                p: 2,
                pb: 0,
                overflow: 'hidden',
                minHeight: 0
            }}>
                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {tipoMemo === 1 && (
                        <PlainTextEditor value={content} onChange={setContent} onAccept={handleAccept} />
                    )}
                    {tipoMemo === 2 && (
                        <CodeEditor value={content} onChange={setContent} onAccept={handleAccept} />
                    )}
                    {tipoMemo === 3 && (
                        <WysiwygEditor value={content} onChange={setContent} />
                    )}
                </Box>
            </DialogContent>

            <DialogActions sx={{
                px: 2,
                py: 1,
                borderTop: '1px solid var(--grid-header-bg, #3c7a7d)',
                backgroundColor: 'var(--fondo-menu, #f1f6f7)'
            }}>
                <Typography variant="caption" sx={{ mr: 'auto', color: 'var(--letra-menu, #334e5a)' }}>
                    {tipoMemo !== 3 ? 'Ctrl+Enter = Aceptar · Esc = Cancelar' : 'Esc = Cancelar'}
                </Typography>
                <Button onClick={onClose} color="inherit" variant="outlined" size="small"
                    sx={{ borderColor: 'var(--grid-header-bg)', color: 'var(--letra-menu)' }}>
                    Cancelar
                </Button>
                <Button onClick={handleAccept} variant="contained" size="small"
                    sx={{ backgroundColor: 'var(--grid-header-bg, #3c7a7d)', '&:hover': { backgroundColor: 'var(--primary-color, #234e66)' } }}>
                    Aceptar
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default MemoEditorDialog;
