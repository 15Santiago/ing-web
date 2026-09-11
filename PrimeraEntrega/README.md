# PrimeraEntrega

Proyecto integrador: gestor académico del colegio — boletín de notas, gestión de docentes
(nómina, horarios, bitácora) y gestión por curso (matrícula, horarios). Separado en tres
carpetas hermanas:

```
PrimeraEntrega/
├── frontend/   → HTML/CSS/JS estático (lo que ve el navegador)
├── backend/    → API Node.js + Express (lo que corre el servidor)
└── DB/         → schema.sql y el seed que carga los datos en MySQL
```

- **`frontend/`** — sin build ni dependencias. Cuatro páginas, todas conectadas a MySQL:
  `index.html` (panel principal / gestor académico, con enlaces a las otras tres),
  `boletin.html` (formulario de notas), `docentes-horario.html` (gestión de docentes:
  dashboard, CRUD, horario semanal, bitácora de movimientos) y `cursos-horario.html`
  (gestión por curso: matrícula, necesidad de docentes, horario semanal). `personal.css` y
  `malla-materias.js` son compartidos por las dos últimas.
- **`backend/`** — servidor Express que expone la API en `/api/*` y sirve `../frontend`
  como archivos estáticos desde el mismo origen (por eso `frontend/` no necesita su propio
  servidor ni configurar CORS). Ver `backend/README.md` para la guía completa de instalación,
  endpoints y estructura interna.
- **`DB/`** — `schema.sql` crea la base de datos `notasAcademicas` y todas sus tablas;
  `DB/seed/seed.js` (se corre con `npm run seed` desde `backend/`) carga los datos reales del
  colegio a partir de `DB/seed/data/*.csv`, extraídos del `Horario_Colegio.xlsx` de la raíz del
  repositorio.

Para levantar el proyecto, sigue la sección **"4. Instalación"** de `backend/README.md`.
