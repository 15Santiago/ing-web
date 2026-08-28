# Backend - Gestión de Notas Académicas

Backend en **Node.js + Express + MySQL** para el proyecto integrador de *Optativa II Desarrollo Móvil*.
Ajustado para funcionar tal cual con el front end del equipo (`index.html` / `styles.css` / `script.js`,
sin modificaciones) y con el `schema.sql` ya definido (base de datos `notasAcademicas`, tabla `Estudiantes`).

## 1. Estructura del proyecto

```
backend-notas/
├── config/
│   └── db.js                     # Conexión (pool) a MySQL
├── controllers/
│   └── estudianteController.js   # Lógica de cada endpoint
├── database/
│   └── schema.sql                 # Tal cual la entregó el equipo (notasAcademicas / Estudiantes)
├── models/
│   └── Estudiante.js              # Clase POO: promedio, aprobación, rendimiento
├── public/                        # Front end del equipo, SIN modificar
│   ├── index.html
│   ├── styles.css
│   └── script.js
├── routes/
│   └── estudianteRoutes.js        # Rutas /api/estudiantes
├── .env.example
├── package.json
└── server.js                      # Sirve el front end (public/) + la API
```

## 2. Por qué el front va dentro de `public/`

Tu `script.js` hace:

```js
const API_URL = 'api/estudiantes';
```

Es una ruta **relativa** (sin `/` inicial ni dominio). Eso significa que el front espera
vivir en el **mismo origen** (mismo host y puerto) que la API. Por eso `server.js` sirve
`index.html`, `styles.css` y `script.js` como archivos estáticos desde `public/`, y monta
la API en `/api/estudiantes`. Así, al abrir `http://localhost:3000/`, el `fetch('api/estudiantes')`
resuelve automáticamente a `http://localhost:3000/api/estudiantes` — cero configuración extra,
y no tuvimos que tocar ni una línea del front end.

## 3. Requisitos previos

- Node.js 18 o superior
- MySQL 8 (o MariaDB compatible) instalado y con el servicio corriendo

## 4. Instalación

```bash
# 1. Entra a la carpeta del backend
cd backend-notas

# 2. Instala las dependencias
npm install

# 3. Crea la base de datos y la tabla (usa el schema.sql del equipo, sin cambios)
mysql -u root -p < database/schema.sql

# 4. Copia el archivo de variables de entorno y ajusta tus credenciales
cp .env.example .env
```

Edita `.env` con tus datos reales de MySQL:

```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=notasAcademicas
```

## 5. Ejecutar

```bash
npm start
```

Deberías ver:

```
✅ Conexión a la base de datos MySQL establecida correctamente.
🚀 Servidor corriendo en http://localhost:3000
   Front end:  http://localhost:3000/
   API:        http://localhost:3000/api/estudiantes
```

Abre **http://localhost:3000/** en el navegador: ahí verás directamente tu formulario
(`index.html`), ya conectado a la base de datos real. No hace falta abrir `index.html`
con doble clic ni con Live Server — todo se sirve desde este mismo servidor.

Para desarrollo con recarga automática:

```bash
npm run dev
```

## 6. Endpoints (coinciden con lo que llama script.js)

Base URL: `http://localhost:3000/api/estudiantes`

| Método | Ruta         | Usado por script.js para...                        |
|--------|--------------|------------------------------------------------------|
| POST   | `/`          | `crearRegistro()` — botón "Guardar registro" (nuevo) |
| GET    | `/`          | `obtenerRegistros()` — cargar la tabla al inicio y tras cada cambio |
| PUT    | `/:id`       | `actualizarRegistro()` — botón "Actualizar registro" (modo edición) |
| DELETE | `/:id`       | `eliminarRegistro()` — botón "Eliminar" de cada fila  |

Extra (no usados por el front actual, pero disponibles si los necesitas):
- `POST /calcular` — calcula sin guardar
- `GET /:id` — consulta un estudiante puntual
- `GET /api/health` — verifica que el servidor está vivo

### Formato de las respuestas

- `GET /api/estudiantes` responde un **arreglo plano** de estudiantes (así lo espera `renderTabla()` en script.js).
- `POST` y `PUT` responden el **objeto plano** del estudiante creado/actualizado, con los mismos nombres
  de campo que usa el front: `id, nombre, nota1, nota2, nota3, nota4, promedio, estado, rendimiento`.
- `DELETE` responde `{ mensaje, id }`.
- Cualquier error responde con código HTTP distinto de 2xx y un body `{ mensaje, errores? }`.

### Ejemplo de respuesta exitosa (POST)

```json
{
  "id": 1,
  "nombre": "Pedro",
  "nota1": 4.5,
  "nota2": 4.0,
  "nota3": 4.2,
  "nota4": 4.5,
  "promedio": 4.3,
  "estado": "Aprobado",
  "rendimiento": "Aprobado con sobresaliente"
}
```

Coincide con el ejemplo de la guía: promedio 4.3 → "Aprobado con sobresaliente".

## 7. Nota importante sobre el cálculo

Tu `script.js` ya calcula promedio/estado/rendimiento en el navegador (con su propia clase
`Estudiante`) y los envía en el body del POST/PUT. El backend **no confía ciegamente** en esos
valores: los vuelve a calcular con su propia clase `Estudiante` (misma lógica, mismos nombres
de campo) antes de guardar. Esto es justamente lo que pide la guía en el punto 5 (POO en el
backend) y evita que alguien manipule el resultado desde las herramientas de red del navegador.

## 8. Pruebas rápidas con curl

```bash
# Crear
curl -X POST http://localhost:3000/api/estudiantes \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Pedro","nota1":4.5,"nota2":4.0,"nota3":4.2,"nota4":4.5}'

# Listar
curl http://localhost:3000/api/estudiantes

# Actualizar (id=1)
curl -X PUT http://localhost:3000/api/estudiantes/1 \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Pedro Actualizado","nota1":5.0,"nota2":5.0,"nota3":5.0,"nota4":5.0}'

# Eliminar (id=1)
curl -X DELETE http://localhost:3000/api/estudiantes/1
```

## 9. Relación con los criterios de la guía

- **JavaScript y funcionamiento (15%)**: `estudianteController.js`, `server.js`, `routes/`.
- **Programación Orientada a Objetos (15%)**: `models/Estudiante.js` (misma lógica que la clase
  `Estudiante` del front, para validar/recalcular en el servidor).
- **Base de datos y operaciones CRUD (20%)**: `database/schema.sql` (`notasAcademicas.Estudiantes`)
  + los 4 endpoints Create/Read/Update/Delete.
- **Cálculo y clasificación de notas (10%)**: métodos `calcularPromedio()`, `determinarAprobacion()`,
  `determinarRendimiento()`, siguiendo exactamente la escala de la guía.
- **Validaciones**: método `validar()` de la clase `Estudiante`, más `CHECK` constraints en la tabla SQL.
