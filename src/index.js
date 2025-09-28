// Carga variables de entorno (útil para desarrollo local, Railway las inyecta automáticamente)
require('dotenv').config();

const express = require('express');
// Usamos 'mysql2/promise' para trabajar con promesas (código asíncrono más limpio)
const mysql = require('mysql2/promise');

const app = express();

// Middleware: Permite que Express lea el cuerpo de las peticiones en formato JSON
app.use(express.json());

// --- Configuración de Conexión a MySQL ---
// Usamos las variables de entorno que Railway provee/vincula.
const dbConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT
};

/**
 * Función que crea una conexión a la DB, la ejecuta y la cierra automáticamente.
 * Esto ayuda a mantener el pool de conexiones eficiente.
 * @returns {Promise<mysql.Connection>} La conexión a la base de datos.
 */
async function getConnection() {
    try {
        // En un entorno de producción con alto tráfico, se recomienda usar un 'Pool' de conexiones.
        return await mysql.createConnection(dbConfig);
    } catch (error) {
        console.error('❌ Error al obtener conexión a la base de datos:', error.message);
        throw new Error('No se pudo conectar a la base de datos.');
    }
}

// --- RUTA DE SALUD (Health Check) ---
app.get('/', (req, res) => {
    res.status(200).send({ message: '🚀 STATIONS SERVICE: ¡Servicio de estaciones online!', status: 'Running' });
});

// ----------------------------------------------------------------------
//                       IMPLEMENTACIÓN DE ENDPOINTS
// ----------------------------------------------------------------------

/**
 * [1] CREAR ESTACIÓN
 * POST /api/stations
 * Registra una nueva estación con ID, nombre, ubicación, tipo y estado ACTIVA por defecto.
 * Asume que el ID es autoincremental en la tabla.
 */
app.post('/api/stations', async (req, res) => {
    const { name, location, type } = req.body;
    
    // Validación básica de campos requeridos
    if (!name || !location || !type) {
        return res.status(400).json({ error: 'Faltan campos requeridos: name, location, type.' });
    }

    // El estado (is_active) se establece a TRUE por defecto en la DB y en el INSERT.
    const is_active = true;

    // TODO: Añadir validación del 'type' (origen, destino, intermedia)
    
    let connection;
    try {
        connection = await getConnection();
        const query = 'INSERT INTO stations (name, location, type, is_active) VALUES (?, ?, ?, ?)';
        const [result] = await connection.execute(query, [name, location, type, is_active]);

        res.status(201).json({ 
            message: 'Estación creada exitosamente.', 
            stationId: result.insertId,
            name,
            location
        });
    } catch (error) {
        console.error('Error al crear estación:', error);
        res.status(500).json({ error: 'Error interno del servidor al crear la estación.' });
    } finally {
        if (connection) await connection.end();
    }
});


/**
 * [2] VISUALIZAR TODAS LAS ESTACIONES
 * GET /api/stations
 * Muestra información esencial de todas las estaciones ACTIVAS. (Solo para Administrador)
 */
app.get('/api/stations', async (req, res) => {
    // Nota: Aquí se debería incluir un middleware de autenticación/autorización (Admin).
    let connection;
    try {
        connection = await getConnection();
        // Solo mostramos estaciones que NO han sido eliminadas lógicamente (is_active = TRUE)
        const query = 'SELECT id, name, location, type, is_active FROM stations WHERE is_active = TRUE';
        const [stations] = await connection.execute(query);

        res.status(200).json(stations);
    } catch (error) {
        console.error('Error al visualizar estaciones:', error);
        res.status(500).json({ error: 'Error interno del servidor al consultar estaciones.' });
    } finally {
        if (connection) await connection.end();
    }
});


/**
 * [3] VISUALIZAR ESTACIÓN POR IDENTIFICADOR (ID)
 * GET /api/stations/:id
 * Muestra información detallada de una estación específica.
 */
app.get('/api/stations/:id', async (req, res) => {
    const stationId = req.params.id;
    let connection;
    try {
        connection = await getConnection();
        // Solo buscamos estaciones activas para la operación (exceptuando información irrelevante como el estado si la parada está inactiva)
        const query = 'SELECT id, name, location, type, is_active FROM stations WHERE id = ? AND is_active = TRUE';
        const [stations] = await connection.execute(query, [stationId]);

        if (stations.length === 0) {
            return res.status(404).json({ error: `Estación con ID ${stationId} no encontrada o inactiva.` });
        }

        // Si la encontramos, mostramos la primera (y única) estación
        res.status(200).json(stations[0]);

    } catch (error) {
        console.error('Error al visualizar estación por ID:', error);
        res.status(500).json({ error: 'Error interno del servidor al consultar la estación.' });
    } finally {
        if (connection) await connection.end();
    }
});


/**
 * [4] EDITAR ESTACIÓN
 * PUT /api/stations/:id
 * Actualiza nombre, ubicación, tipo y estado de una estación.
 */
app.put('/api/stations/:id', async (req, res) => {
    const stationId = req.params.id;
    // Recibimos todos los campos editables, incluyendo el estado (is_active)
    const { name, location, type, is_active } = req.body; 

    // Validación básica
    if (!name || !location || !type || typeof is_active !== 'boolean') {
         return res.status(400).json({ error: 'Faltan campos requeridos o el estado (is_active) no es booleano.' });
    }
    
    let connection;
    try {
        connection = await getConnection();
        const query = `
            UPDATE stations 
            SET name = ?, location = ?, type = ?, is_active = ? 
            WHERE id = ?
        `;
        const [result] = await connection.execute(query, [name, location, type, is_active, stationId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: `Estación con ID ${stationId} no encontrada.` });
        }

        res.status(200).json({ message: `Estación ID ${stationId} actualizada exitosamente.` });
    } catch (error) {
        console.error('Error al editar estación:', error);
        res.status(500).json({ error: 'Error interno del servidor al actualizar la estación.' });
    } finally {
        if (connection) await connection.end();
    }
});


/**
 * [5] ELIMINAR ESTACIÓN (Soft Delete)
 * DELETE /api/stations/:id
 * Desactiva temporalmente la estación (is_active = FALSE), preservando el registro.
 * La acción solo puede ser realizada por administradores.
 */
app.delete('/api/stations/:id', async (req, res) => {
    const stationId = req.params.id;
    // Nota: Aquí se debería incluir un middleware de autorización (Solo Admin).
    
    let connection;
    try {
        connection = await getConnection();
        // Usamos SOFT DELETE: marcamos is_active = FALSE en lugar de borrar la fila.
        const query = 'UPDATE stations SET is_active = FALSE WHERE id = ? AND is_active = TRUE'; 
        const [result] = await connection.execute(query, [stationId]);

        if (result.affectedRows === 0) {
            // Podría ser 404 (no existe) o 409 (ya está inactiva)
            return res.status(404).json({ error: `Estación con ID ${stationId} no encontrada o ya estaba inactiva.` });
        }
        
        res.status(200).json({ message: `Estación ID ${stationId} desactivada (Soft Delete) exitosamente.` });
    } catch (error) {
        console.error('Error al desactivar estación:', error);
        res.status(500).json({ error: 'Error interno del servidor al desactivar la estación.' });
    } finally {
        if (connection) await connection.end();
    }
});


// ----------------------------------------------------------------------
//                       INICIO DEL SERVIDOR
// ----------------------------------------------------------------------

// **CRUCIAL:** Usa process.env.PORT, que Railway inyecta dinámicamente.
// El 3000 es solo el valor de reserva para cuando lo ejecutas localmente.
const PORT = process.env.PORT || 3000; 

app.listen(PORT, () => {
    console.log(`🚀 Servidor Express iniciado en el puerto: ${PORT}`);
    console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
});