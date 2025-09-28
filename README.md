# perla-metro-stations-service

Este servicio se encarga de la gestión exclusiva de estaciones (CRUD y Soft Delete) para el sistema de trenes, siguiendo los principios de la Arquitectura Orientada a Servicios (SOA).

## Arquitectura y Patrón de Diseño
* **Arquitectura:** Orientada a Servicios (SOA).
* **Patrón:** API RESTful.
* **Tecnología:** Node.js, Express, MySQL (Railway).

## Ejecución Local

### Prerrequisitos
1.  Node.js (v18+)
2.  MySQL (o usar las credenciales de Railway en .env)

### Pasos
1.  Clona el repositorio.
2.  Instala dependencias: `npm install`
3.  Crea un archivo `.env` en la raíz con las credenciales de tu base de datos (ver sección Cifrado y Seguridad).
4.  Inicia el servidor en modo desarrollo: `npm run dev`
    El servidor estará disponible en `http://localhost:3000`.

## Despliegue en la Nube (Railway)
Este servicio se despliega automáticamente a través de la integración de GitHub y Railway. La variable de entorno `DATABASE_URL` es inyectada por Railway para la conexión.

## Cifrado y Seguridad
* **Contraseñas:** Este servicio no maneja contraseñas de usuarios. Si lo hiciera, se usaría **bcrypt** para el hash.
* **Conexión DB:** Se utiliza el módulo `mysql2` con `createPool` para una gestión eficiente y segura de las conexiones, usando la `DATABASE_URL` proporcionada por el entorno (Railway) o `.env` (local).
* **Autorización:** Las rutas sensibles (`POST`, `PUT`, `DELETE`, `GET /api/stations`) están protegidas con el middleware `authorizeAdmin` para aplicar el control de acceso basado en rol/privilegios.

## Consultas Disponibles (Endpoints)

| Método | Ruta | Descripción | Autorización |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/stations` | Crea una nueva estación. | Administrador |
| `GET` | `/api/stations` | Lista todas las estaciones activas. | Administrador |
| `GET` | `/api/stations/:id` | Obtiene detalles de una estación activa. | Público |
| `PUT` | `/api/stations/:id` | Actualiza una estación existente. | Administrador |
| `DELETE`| `/api/stations/:id` | Desactiva temporalmente una estación (Soft Delete). | Administrador |