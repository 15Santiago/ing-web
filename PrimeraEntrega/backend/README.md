# Backend de Gestión de Notas

Backend migrado de Node.js/Express a **FastAPI + MySQL**. Conserva las rutas `/api/*`, las respuestas consumidas por el frontend y el servicio de archivos estáticos en `public/`.

## Requisitos

- Python 3.11 o superior
- MySQL 8 o MariaDB compatible

## Instalación en Windows

```powershell
cd PrimeraEntrega\backend
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Configura `.env` con las credenciales de MySQL. La base de datos se crea ejecutando `database/schema.sql`.

## Ejecutar

El servidor no se inicia automáticamente. Cuando quieras levantarlo:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload
```

La aplicación queda disponible en `http://localhost:3000/` y la documentación interactiva en `/docs`.

## Estructura

- `app/main.py`: composición de FastAPI, middleware, ciclo de vida y montaje del frontend.
- `app/routers/`: routers por dominio (`students`, `organization` y `areas`); los demás dominios se extraerán siguiendo el mismo patrón.
- `app/schemas.py`: modelos Pydantic de entrada.
- `app/common.py`: consultas compartidas, errores y validación de estudiantes.
- `app/database.py`: pool asíncrono de conexiones MySQL con `aiomysql`.
- `app/organization.py`: cálculo de planificación académica.
- `public/`: frontend servido por FastAPI.
- `database/schema.sql`: esquema MySQL y `database/seed/data/`: datos CSV.

## API principal

- `GET /api/health`
- `GET|POST /api/estudiantes`
- `GET|PUT|DELETE /api/estudiantes/{id}`
- `GET|POST /api/organizacion/configuracion` y `/api/organizacion/planificar`
- CRUD de `/api/materias`, `/api/cursos`, `/api/docentes` y `/api/horarios`
- `GET /api/dashboard`

La conexión a MySQL se crea bajo demanda al acceder a un endpoint que la necesita. Importar la aplicación o consultar `/api/health` no requiere que MySQL esté iniciado.
