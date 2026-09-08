# PrimeraEntrega

Proyecto integrador: gestión de notas académicas + programación académica del colegio
(cursos, docentes, horarios). Separado en tres carpetas hermanas:

```
PrimeraEntrega/
├── frontend/   → HTML/CSS/JS estático (lo que ve el navegador)
├── backend/    → API Node.js + Express (lo que corre el servidor)
└── DB/         → schema.sql y el seed que carga los datos en MySQL
```

- **`frontend/`** — sin build ni dependencias: `index.html` (boletín de notas),
  `personal.html` (gestión real de docentes/cursos/horarios, conectada a MySQL) y
  `organizacion.html` (simulador de planeación anual, no persiste en BD).
- **`backend/`** — servidor Express que expone la API en `/api/*` y sirve `../frontend`
  como archivos estáticos desde el mismo origen (por eso `frontend/` no necesita su propio
  servidor ni configurar CORS). Ver `backend/README.md` para la guía completa de instalación,
  endpoints y estructura interna.
- **`DB/`** — `schema.sql` crea la base de datos `notasAcademicas` y todas sus tablas;
  `DB/seed/seed.js` (se corre con `npm run seed` desde `backend/`) carga los datos reales del
  colegio a partir de `DB/seed/data/*.csv`, extraídos del `Horario_Colegio.xlsx` de la raíz del
  repositorio.

Para levantar el proyecto, sigue la sección **"4. Instalación"** de `backend/README.md`.
