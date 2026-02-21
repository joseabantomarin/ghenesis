require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./config/db');
// Importar rutas (las crearemos pronto)
const dynamicApiRoutes = require('./routes/dynamicApi');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Importar MetadataService
const MetadataService = require('./services/MetadataService');

// Verificar conexión a DB y cargar caché si es necesario
db.query('SELECT NOW()')
    .then(() => {
        console.log('✅ Base de datos conectada correctamente (PostgreSQL)');
    })
    .catch(err => {
        console.error('❌ Base de datos no conectada. Se usarán Mocks...');
    })
    .finally(() => {
        // Inicializaremos el MetadataService para cachear los meta-datos
        MetadataService.initCache().then(() => {
            console.log('✅ Motor Metadata iniciado');
        });
    });

// Rutas
app.use('/api/dynamic', dynamicApiRoutes);

// Endpoint de prueba
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Ghenesis Backend Engine is running' });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor backend escuchando en http://localhost:${PORT}`);
});
