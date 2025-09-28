// src/index.js
require('dotenv').config(); // Carga variables de .env en desarrollo

const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

app.use(express.json()); // Middleware para parsear JSON

// --- Configuración de Conexión a MySQL ---
// Railway provee la variable DATABASE_URL, que es la forma más simple de conectar.
const dbConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT
};

// Función para probar la conexión a la DB
async function connectToDatabase() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conexión exitosa a MySQL en Railway.');
        await connection.end(); // Cierra la conexión de prueba
    } catch (error) {
        console.error('❌ Error al conectar a la base de datos:', error.message);
        // En producción (Railway) esto es crítico
        if (process.env.NODE_ENV === 'production') {
             // Opcional: Detener la aplicación si no puede conectar a la DB
             // process.exit(1); 
        }
    }
}

connectToDatabase();

// --- Ruta de Bienvenida para Pruebas ---
app.get('/', (req, res) => {
    res.status(200).send({ message: 'STATIONS SERVICE: ¡Listo para recibir peticiones!' });
});

// --- Iniciar Servidor ---
// **CRUCIAL:** Usa process.env.PORT, no un puerto fijo.
const PORT = process.env.PORT || 3000; 

app.listen(PORT, () => {
    console.log(`🚀 Servidor Express iniciado en el puerto: ${PORT}`);
});

// ¡Aquí deberás agregar todas tus rutas CRUD para las estaciones!