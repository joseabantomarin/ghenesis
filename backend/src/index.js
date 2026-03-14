require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./config/db');
// Importar rutas
const dynamicApiRoutes = require('./routes/dynamicApi');
const authRoutes = require('./routes/authRoutes');
const authMiddleware = require('./middlewares/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Importar Servicios
const MetadataService = require('./services/MetadataService');
const SequenceService = require('./services/SequenceService');

// Verificar conexión a DB y cargar caché si es necesario
db.query('SELECT NOW()')
    .then(async () => {
        console.log('✅ Base de datos conectada correctamente (PostgreSQL)');
        // Sincronizar secuencias para que funcionen como AUTO_INCREMENT
        await SequenceService.syncAllSequences();
    })
    .catch(err => {
        console.error('❌ Base de datos no conectada. Se usarán Mocks...');
    })
    .finally(() => {
        // Inicializaremos el MetadataService para cachear los meta-datos
        MetadataService.initCache().then(() => {
            console.log('✅ Motor Metadata iniciado. Listo para servir tráfico.');

            // Iniciar servidor SOLO cuando el caché en memoria esté listo
            app.listen(PORT, () => {
                console.log(`🚀 Servidor backend escuchando en http://localhost:${PORT}`);
            });
        }).catch(err => {
            console.error('❌ Falla crítica al inicializar Metadata:', err);
        });
    });

// Rutas
app.use('/api/auth', authRoutes);

// Ruta PÚBLICA para configuración del sistema (Login necesita leer esto sin auth)
app.get('/api/sistema-config', async (req, res) => {
    try {
        const config = await MetadataService.getSistemaConfig(true);
        res.json({ success: true, data: config });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.use('/api/dynamic', authMiddleware, dynamicApiRoutes);

// Endpoint de prueba
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Ghenesis Backend Engine is running' });
});
