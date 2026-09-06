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
│   ├── estudianteController.js   # Lógica de cada endpoint (notas)
│   ├── organizacionController.js # Simulador anterior (no persiste en BD)
│   ├── areaController.js         # Catálogo de áreas/especialidades
│   ├── materiaController.js      # CRUD de asignaturas + intensidad horaria
│   ├── cursoController.js        # CRUD de cursos + aleatorizar cupos
│   ├── docenteController.js      # CRUD docentes + despedir/asignar vacantes
│   ├── horarioController.js      # CRUD horarios + consultas + conflictos
│   └── dashboardController.js    # Resumen general de la programación
├── database/
│   ├── schema.sql                 # notasAcademicas: Estudiantes + programación académica real
│   └── seed/
│       ├── data/*.csv             # Datos reales extraídos de Horario_Colegio.xlsx
│       └── seed.js                # Carga esos CSV en MySQL (npm run seed)
├── models/
│   └── Estudiante.js              # Clase POO: promedio, aprobación, rendimiento
├── public/                        # Front end servido tal cual (estático)
│   ├── index.html / styles.css / script.js       # Boletín de notas (app original)
│   ├── organizacion.html / .css / .js            # Simulador de planeación (sin BD)
│   └── personal.html / .css / .js                # Gestión real de personal y horarios (con BD)
├── routes/
│   ├── estudianteRoutes.js, organizacionRoutes.js
│   └── areaRoutes.js, materiaRoutes.js, cursoRoutes.js, docenteRoutes.js, horarioRoutes.js, dashboardRoutes.js
├── services/
│   └── organizacionService.js     # Cálculo de cargas y asignaciones (simulador)
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

# 3. Crea la base de datos y todas las tablas (notas + programación académica)
mysql -u root -p < database/schema.sql

# 4. Copia el archivo de variables de entorno y ajusta tus credenciales
cp .env.example .env

# 5. Carga los datos reales del colegio (cursos, docentes, materias y horario)
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

### API de organización académica

La nueva vista está disponible en `http://localhost:3000/organizacion.html` y también desde
el botón **Organizar docentes y horarios** del boletín.

- `GET /api/organizacion/configuracion` — devuelve cursos, jornadas, estudiantes y materias.
- `POST /api/organizacion/planificar` — calcula horas semanales/anuales, distribución por jornada,
  docentes requeridos, faltantes y carga individual de cada docente.

El cuerpo del `POST` es opcional y permite probar otros escenarios:

```json
{
  "docentesDisponibles": 30,
  "horasTrabajoDocenteSemana": 40,
  "semanasAnioLectivo": 40,
  "horasExtraSemanaMax": 1,
  "horasExtraMesMax": 4
}
```

La configuración inicial interpreta `+` como mayor intensidad horaria y `-` como menor intensidad.
Séptimo queda con 6 cursos, 3 en cada jornada, porque esa es la distribución indicada en los datos.
La nómina está limitada a 30 docentes: no se contratan docentes adicionales. Cada docente tiene
40 horas normales semanales, 1 hora extra semanal como máximo y 4 horas extra mensuales como máximo;
la hora diaria de almuerzo queda fuera de las 8 horas laborales. Con los valores iniciales se calculan
79 cursos, 2.242 estudiantes, 2.184 horas semanales, 55 docentes necesarios y 974 horas semanales
pendientes que no pueden cubrirse con los 30 docentes permitidos.

### API de personal docente y horarios (con base de datos real)

Vista en `http://localhost:3000/personal.html` (botón **Personal docente y horarios** del boletín).
A diferencia del simulador anterior, todo aquí lee y escribe en MySQL: 79 cursos, 30 docentes y
los bloques de horario reales (uno por cada clase de 45 minutos, con su curso/materia/día/hora),
cargados con `npm run seed` desde `database/seed/data/*.csv` (extraídos de `Horario_Colegio.xlsx`).
Si el Excel cambia (correcciones al horario, nuevos docentes, etc.), vuelve a extraer esas hojas a
CSV en `database/seed/data/` y corre `npm run seed` de nuevo para refrescar la base de datos.

| Recurso | Endpoints |
|---|---|
| Áreas | `GET /api/areas` |
| Materias | `GET/POST /api/materias`, `PUT/DELETE /api/materias/:id`, `POST/PUT/DELETE /api/materias/plan[/:id]` (intensidad horaria por nivel) |
| Cursos | `GET/POST /api/cursos` (filtros `?jornada=&grado=`), `GET/PUT/DELETE /api/cursos/:id`, `POST /api/cursos/aleatorizar-cupos` |
| Docentes | `GET/POST /api/docentes` (filtros `?activo=&areaId=`), `GET/PUT/DELETE /api/docentes/:id`, `POST /api/docentes/despedir`, `POST /api/docentes/:id/asignar-vacantes` |
| Horarios | `GET/POST /api/horarios` (filtros `?cursoId=&docenteId=&materiaId=&jornada=&dia=&vacantes=true`), `GET /api/horarios/conflictos`, `PUT/DELETE /api/horarios/:id`, `PUT /api/horarios/:id/asignar` |
| Dashboard | `GET /api/dashboard` |

**Despedir docentes** (`POST /api/docentes/despedir` con `{ "ids": ["MAT-FIS-01", "MAT-FIS-02"] }`)
marca a esos docentes como inactivos y deja sus bloques de horario vacantes (`docente_id = NULL`),
devolviendo el impacto: cuántos bloques y qué cursos quedaron afectados, con materia/día/hora de
cada clase sin cubrir.

**Contratar** (`POST /api/docentes` con `{ "nombre", "areaId", "horasContratadas" }`) crea el
docente (si no se manda `id`, se genera uno correlativo dentro de su área, ej. `MAT-FIS-07`). Para
cargarle horario se usa `PUT /api/horarios/:id/asignar` con `{ "docenteId" }` sobre un bloque
vacante (o el bulk `POST /api/docentes/:id/asignar-vacantes` con `{ "horarioIds": [...] }`), que
valida que no choque con otra clase suya y que no supere sus horas contratadas.

**Conflictos de horario** ("un docente o curso asignado simultáneamente") están impedidos por
diseño con las llaves `UNIQUE (curso_id, dia, hora_inicio)` y `UNIQUE (docente_id, dia, hora_inicio)`
de la tabla `horarios`; `GET /api/horarios/conflictos` los expone explícitamente para el dashboard.

El número de estudiantes de un curso se trata como variable aleatoria acotada por su cupo máximo:
se genera al azar (entre 75% y 100% del cupo) en el seed y cada vez que se llama a
`POST /api/cursos/aleatorizar-cupos`; también se puede fijar a mano con `PUT /api/cursos/:id`.

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
