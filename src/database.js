/**
 * Módulo para inicializar y gestionar el pool de conexiones a la base de datos MySQL.
 * Esto asegura una gestión eficiente de los recursos de la DB.
 */
const mysql = require('mysql2/promise');

// La variable DATABASE_URL es la que Railway inyecta
const connectionUrl = process.env.DATABASE_URL;

// Inicializa el pool de conexiones
const pool = mysql.createPool({
    uri: connectionUrl, // Usa la URL de conexión completa
    waitForConnections: true,
    connectionLimit: 10, // Define el límite de conexiones (ajustable)
    queueLimit: 0 
});

/**
 * Función que obtiene una conexión del pool.
 * @returns {Promise<mysql.PoolConnection>} Una conexión disponible del pool.
 */
async function getPoolConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Conexión obtenida del pool.');
        return connection;
    } catch (error) {
        console.error('Error crítico al obtener conexión del pool:', error.message);
        // Si no podemos obtener una conexión, la aplicación no puede funcionar.
        throw new Error('Database connection failed.'); 
    }
}

// Exporta la función para que index.js la use
module.exports = {
    getPoolConnection,
    pool // El pool también puede ser exportado si se necesita directamente
};