/**
 * Módulo principal del servicio de estaciones.
 * Expone la API RESTful para la gestión de estaciones de metro.
 */
require('dotenv').config();

const express = require('express');
const { getPoolConnection } = require('./database'); // Importa la función de conexión desde database.js

const app = express();

// Middleware para parsear el cuerpo de las peticiones en formato JSON
app.use(express.json());

// Tipos de parada válidos (para validación en Node.js, ya que no usamos ENUM en MySQL)
const VALID_TYPE_IDS = [1, 2, 3]; // 1: Origen, 2: Destino, 3: Intermedia (ejemplo)

// RUTA DE SALUD (Health Check)
app.get('/', (req, res) => {
    res.status(200).send({ 
        message: 'STATIONS SERVICE: ¡Servicio de estaciones online!', 
        status: 'Running' 
    });
});

// IMPLEMENTACIÓN DE ENDPOINTS CRUD

/**
 * Middleware de Autorización (Simulado)
 * Función placeholder para controlar el acceso a rutas sensibles (Admin).
 * En una aplicación real, se verificaría un token JWT o una sesión.
 */
const authorizeAdmin = (req, res, next) => {
    // Simulación: Si no hay un encabezado de autorización, negamos el acceso
    if (!req.headers.authorization) {
        return res.status(401).json({ error: 'Acceso denegado. Se requiere autenticación de Administrador.' });
    }
    next(); 
};


/**
 * [1] CREAR ESTACIÓN: Registra una nueva estación.
 * POST /api/stations
 */
app.post('/api/stations', authorizeAdmin, async (req, res) => {
    const { name, location, type_id } = req.body;
    
    // Validación de campos requeridos y de tipo (usando el ID numérico)
    if (!name || !location || !type_id || !VALID_TYPE_IDS.includes(type_id)) {
        return res.status(400).json({ error: 'Datos de entrada inválidos. Asegúrese de incluir name, location y un type_id válido (1, 2, o 3).' });
    }
    
    // El estado de la estación es ACTIVA por defecto
    const is_active = true;
    
    let connection;
    try {
        // Usamos un pool para manejar conexiones eficientemente
        connection = await getPoolConnection(); 
        
        // Consulta INSERT: Note que usamos 'type_id'
        const query = 'INSERT INTO stations (name, location, type_id, is_active) VALUES (?, ?, ?, ?)';
        const [result] = await connection.execute(query, [name, location, type_id, is_active]);

        res.status(201).json({ 
            message: 'Estación creada exitosamente.', 
            stationId: result.insertId,
            name,
            location
        });
    } catch (error) {
        console.error('Error al crear estación:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
        if (connection) connection.release(); // Libera la conexión al pool
    }
});


/**
 * [2] VISUALIZAR TODAS LAS ESTACIONES ACTIVAS (ADMIN/OPERACIONES)
 * GET /api/stations
 */
app.get('/api/stations', authorizeAdmin, async (req, res) => {
    let connection;
    try {
        connection = await getPoolConnection();
        // Se muestran todas las estaciones ACTIVAS
        const query = 'SELECT id, name, location, type_id, is_active FROM stations WHERE is_active = TRUE';
        const [stations] = await connection.execute(query);

        res.status(200).json(stations);
    } catch (error) {
        console.error('Error al visualizar estaciones:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al consultar estaciones.' });
    } finally {
        if (connection) connection.release();
    }
});


/**
 * [3] VISUALIZAR ESTACIÓN POR IDENTIFICADOR (ID)
 * GET /api/stations/:id
 */
app.get('/api/stations/:id', async (req, res) => {
    const stationId = req.params.id;
    let connection;
    try {
        connection = await getPoolConnection();
        // Se busca por ID. Solo se devuelve si está ACTIVA (is_active = TRUE)
        const query = 'SELECT id, name, location, type_id, is_active FROM stations WHERE id = ? AND is_active = TRUE';
        const [stations] = await connection.execute(query, [stationId]);

        if (stations.length === 0) {
            return res.status(404).json({ error: `Estación con ID ${stationId} no encontrada o inactiva.` });
        }

        res.status(200).json(stations[0]);
    } catch (error) {
        console.error('Error al visualizar estación por ID:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
        if (connection) connection.release();
    }
});


/**
 * [4] EDITAR ESTACIÓN: Actualiza los datos de una estación.
 * PUT /api/stations/:id
 */
app.put('/api/stations/:id', authorizeAdmin, async (req, res) => {
    const stationId = req.params.id;
    const { name, location, type_id, is_active } = req.body; 

    // Validación de campos obligatorios y tipo de dato.
    if (!name || !location || !type_id || typeof is_active !== 'boolean' || !VALID_TYPE_IDS.includes(type_id)) {
         return res.status(400).json({ error: 'Datos de entrada inválidos para la actualización.' });
    }
    
    let connection;
    try {
        connection = await getPoolConnection();
        const query = `
            UPDATE stations 
            SET name = ?, location = ?, type_id = ?, is_active = ? 
            WHERE id = ?
        `;
        const [result] = await connection.execute(query, [name, location, type_id, is_active, stationId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: `Estación con ID ${stationId} no encontrada.` });
        }

        res.status(200).json({ message: `Estación ID ${stationId} actualizada exitosamente.` });
    } catch (error) {
        console.error('Error al editar estación:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
        if (connection) connection.release();
    }
});


/**
 * [5] ELIMINAR ESTACIÓN (SOFT DELETE): Desactiva la estación.
 * DELETE /api/stations/:id
 */
app.delete('/api/stations/:id', authorizeAdmin, async (req, res) => {
    const stationId = req.params.id;
    
    let connection;
    try {
        connection = await getPoolConnection();
        // SOFT DELETE: Cambia is_active a FALSE. Solo si estaba activa.
        const query = 'UPDATE stations SET is_active = FALSE WHERE id = ? AND is_active = TRUE'; 
        const [result] = await connection.execute(query, [stationId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: `Estación con ID ${stationId} no encontrada o ya estaba inactiva.` });
        }
        
        res.status(200).json({ message: `Estación ID ${stationId} desactivada (Soft Delete) exitosamente.` });
    } catch (error) {
        console.error('Error al desactivar estación:', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
        if (connection) connection.release();
    }
});


// INICIO DEL SERVIDOR
const PORT = process.env.PORT || 3000; 

app.listen(PORT, () => {
    console.log(`Servidor Express iniciado en el puerto: ${PORT}`);
    console.log(`Accede a la API en: http://localhost:${PORT}/`);
});