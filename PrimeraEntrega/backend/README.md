# Backend - Gestión de Notas Académicas

Backend en **Node.js + Express + MySQL** para el proyecto integrador de *Optativa II Desarrollo Móvil*.
Vive dentro de `PrimeraEntrega/`, junto a sus dos carpetas hermanas: `frontend/` (HTML/CSS/JS
estático) y `DB/` (schema.sql y el seed) — ver el diagrama completo más abajo.

## 1. Estructura del proyecto

```
PrimeraEntrega/
├── frontend/                      # Front end estático, servido tal cual por server.js
│   ├── index.html                                    # Panel principal (Gestor Académico), enlaza las otras 3
│   ├── home.css / home.js                            # Estilos y estadísticas en vivo del panel principal
│   ├── boletin.html / styles.css / script.js          # Boletín de notas (app original)
│   ├── docentes-horario.html / docentes-horario.js    # Gestión de docentes: dashboard, CRUD, horario, bitácora
│   ├── cursos-horario.html / cursos-horario.js        # Gestión por curso: matrícula, necesidad de docentes, horario
│   ├── personal.css                                   # Compartido por docentes-horario y cursos-horario
│   └── malla-materias.js                              # Malla de asignaturas, compartida por las dos anteriores
├── DB/                             # Todo lo de base de datos, fuera del código del servidor
│   ├── schema.sql                  # notasAcademicas: Estudiantes + programación académica real
│   └── seed/
│       ├── data/*.csv              # Datos reales extraídos de Horario_Colegio.xlsx
│       └── seed.js                 # Carga esos CSV en MySQL (npm run seed, desde backend/)
└── backend/                        # Este servidor (Node.js + Express) + la API
    ├── config/
    │   └── db.js                     # Conexión (pool) a MySQL
    ├── controllers/
    │   ├── estudianteController.js   # Lógica de cada endpoint (notas)
    │   ├── areaController.js         # Catálogo de áreas/especialidades + horas sugeridas para contratar
    │   ├── materiaController.js      # CRUD de asignaturas + intensidad horaria
    │   ├── cursoController.js        # CRUD de cursos + aleatorizar estudiantes
    │   ├── docenteController.js      # CRUD docentes + despedir/activar/asignar vacantes + bitácora
    │   ├── horarioController.js      # CRUD horarios + consultas + conflictos
    │   └── dashboardController.js    # Resumen general de la programación
    ├── models/
    │   └── Estudiante.js              # Clase POO: promedio, aprobación, rendimiento
    ├── routes/
    │   ├── estudianteRoutes.js, areaRoutes.js, materiaRoutes.js, cursoRoutes.js
    │   └── docenteRoutes.js, horarioRoutes.js, dashboardRoutes.js
    ├── services/
    │   ├── necesidadDocentesService.js    # Docentes necesarios, balanceo automático de nómina y horas sugeridas por área
    │   └── docenteLogService.js           # Bitácora: contrataciones, despidos, recontrataciones, actualizaciones
    ├── .env.example
    ├── package.json
    └── server.js                      # Sirve ../frontend (estático) + la API
```

## 2. Por qué el front vive en una carpeta hermana (`../frontend`)

`script.js` hace:

```js
const API_URL = 'api/estudiantes';
```

Es una ruta **relativa** (sin `/` inicial ni dominio). Eso significa que el front espera
vivir en el **mismo origen** (mismo host y puerto) que la API, aunque su código esté en
una carpeta aparte. Por eso `server.js` sirve `index.html`, `styles.css`, `script.js`, etc.
como archivos estáticos desde `../frontend`, y monta la API en `/api/estudiantes`. Así, al
abrir `http://localhost:3000/`, el `fetch('api/estudiantes')` resuelve automáticamente a
`http://localhost:3000/api/estudiantes` — cero configuración extra, un solo servidor
corriendo, y el front end sigue viviendo en su propia carpeta separada del backend.

## 3. Requisitos previos

- Node.js 18 o superior
- MySQL 8 (o MariaDB compatible) instalado y con el servicio corriendo

## 4. Instalación

```bash
# 1. Entra a la carpeta del backend
cd PrimeraEntrega/backend

# 2. Instala las dependencias
npm install

# 3. Crea la base de datos y todas las tablas (notas + programación académica),
#    definidas en la carpeta DB/ hermana de backend/
mysql -u root -p < ../DB/schema.sql

# 4. Copia el archivo de variables de entorno y ajusta tus credenciales
cp .env.example .env

# 5. Carga los datos reales del colegio (cursos, docentes, materias y horario)
#    desde DB/seed/data/*.csv
npm run seed
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

Abre **http://localhost:3000/** en el navegador: ahí verás el panel principal
(`index.html`), con acceso al boletín de notas, la gestión de docentes y la gestión por
curso, ya conectados a la base de datos real. No hace falta abrir ningún archivo con doble
clic ni con Live Server — todo se sirve desde este mismo servidor.

Para desarrollo con recarga automática:

```bash
npm run dev
```

## 6. Endpoints de estudiantes (coinciden con lo que llama script.js)

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

### Gestión de docentes y gestión por curso (con base de datos real)

Dos vistas, ambas leen y escriben en MySQL: `http://localhost:3000/docentes-horario.html`
(dashboard general, CRUD de docentes, horario semanal por docente y bitácora de movimientos)
y `http://localhost:3000/cursos-horario.html` (matrícula por curso, necesidad de docentes y
horario semanal por curso). Ambas comparten la malla de asignaturas e intensidad horaria
(`malla-materias.js`, agrupada por área/componente y grado, con cuántos cursos recibe cada
materia y cuántos docentes hacen falta solo para ella). Hasta 42 cursos (secciones), un máximo
de 30 docentes y los bloques de horario reales (uno por cada clase de 45 minutos, con su
curso/materia/día/hora — no hay bloques de "trabajo autónomo": toda la jornada son clases),
cargados con `npm run seed` desde `../DB/seed/data/*.csv` (extraídos de `Horario_Colegio.xlsx`).
Si el Excel cambia (correcciones al horario, nuevos docentes, etc.), vuelve a extraer esas hojas
a CSV en `../DB/seed/data/` y corre `npm run seed` de nuevo para refrescar la base de datos.

| Recurso | Endpoints |
|---|---|
| Áreas | `GET /api/areas`, `GET /api/areas/:id/horas-sugeridas` (horas que conviene contratarle a un docente nuevo de esa área, según lo que haga falta ahí) |
| Materias | `GET/POST /api/materias`, `PUT/DELETE /api/materias/:id`, `POST/PUT/DELETE /api/materias/plan[/:id]` (intensidad horaria por nivel) |
| Cursos | `GET/POST /api/cursos` (filtros `?jornada=&grado=&activo=`), `GET/PUT/DELETE /api/cursos/:id`, `POST /api/cursos/aleatorizar-estudiantes` |
| Docentes | `GET/POST /api/docentes` (filtros `?activo=&areaId=`), `GET/PUT/DELETE /api/docentes/:id`, `POST /api/docentes/despedir`, `POST /api/docentes/:id/activar`, `POST /api/docentes/:id/asignar-vacantes`, `GET /api/docentes/log` (bitácora, filtros `?docenteId=&limite=`) |
| Horarios | `GET/POST /api/horarios` (filtros `?cursoId=&docenteId=&materiaId=&jornada=&dia=&vacantes=true`), `GET /api/horarios/conflictos`, `PUT/DELETE /api/horarios/:id`, `PUT /api/horarios/:id/asignar` — hoy sin interfaz propia (se dejó de exponer "Bloques vacantes" en el front), pero disponibles para integraciones o una futura vista |
| Dashboard | `GET /api/dashboard` |

**Aleatorizar estudiantes** (`POST /api/cursos/aleatorizar-estudiantes`, botón en ambas
vistas) sortea, por grado, una matrícula total acotada entre el 50% y el 100% de la capacidad
física del grado (secciones ya creadas × cupo máximo por sección), calcula cuántas secciones
hacen falta para esa matrícula (sin superar las secciones creadas) y abre/cierra secciones en
consecuencia: las que se cierran quedan en 0 estudiantes y sus bloques de horario se vacían.
A continuación, **balancea automáticamente la nómina por área** (`balancearNomina` en
`necesidadDocentesService.js`, dentro de la misma transacción): despide a los docentes que
sobran en cada área (los de menos horas asignadas primero, ya que quedaron con menos carga) y
recontrata a los que faltan (los dados de baja más recientemente primero), sin superar nunca
los 30 docentes de `configuracion_colegio.capacidad_nomina`. Todo movimiento —manual o
automático— queda registrado en la bitácora (`docentes_log`, expuesta en `GET /api/docentes/log`).

**Contratar** (`POST /api/docentes` con `{ "nombre", "areaId", "horasContratadas" }`) — desde
la interfaz, las horas contratadas no se escriben a mano: `GET /api/areas/:id/horas-sugeridas`
calcula cuántas horas semanales hacen falta en esa área ahora mismo (bloques de sus cursos
activos, convertidos a horas, menos lo que ya cubren sus docentes activos) y las sugiere
automáticamente, con tiempo completo (34.5 h) como sugerencia por defecto cuando no hace falta
nada puntual. Si no se manda `id`, se genera uno correlativo dentro del área (ej. `MAT-FIS-07`).

**Despedir** (`POST /api/docentes/despedir` con `{ "ids": ["MAT-FIS-01", "MAT-FIS-02"] }`)
marca a esos docentes como inactivos y deja sus bloques de horario vacantes (`docente_id = NULL`).
**Recontratar** (`POST /api/docentes/:id/activar`) los vuelve a poner activos; sus clases
anteriores quedaron vacantes y no se reasignan solas, para no generar choques de horario.

**Conflictos de horario** ("un docente o curso asignado simultáneamente") están impedidos por
diseño con las llaves `UNIQUE (curso_id, dia, hora_inicio)` y `UNIQUE (docente_id, dia, hora_inicio)`
de la tabla `horarios`; `GET /api/horarios/conflictos` los expone explícitamente y el dashboard
los cuenta.

El número de estudiantes de un curso es una variable aleatoria acotada por su cupo máximo: se
genera al azar (entre 75% y 100% del cupo) en el seed, se recalcula por grado con
`POST /api/cursos/aleatorizar-estudiantes`, y también se puede fijar a mano con `PUT /api/cursos/:id`.

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
- **Base de datos y operaciones CRUD (20%)**: `../DB/schema.sql` (`notasAcademicas.Estudiantes`)
  + los 4 endpoints Create/Read/Update/Delete.
- **Cálculo y clasificación de notas (10%)**: métodos `calcularPromedio()`, `determinarAprobacion()`,
  `determinarRendimiento()`, siguiendo exactamente la escala de la guía.
- **Validaciones**: método `validar()` de la clase `Estudiante`, más `CHECK` constraints en la tabla SQL.
