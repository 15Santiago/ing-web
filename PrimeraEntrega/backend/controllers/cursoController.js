// =========================================================
// Gestión de cursos: grado, sección, jornada, número de
// estudiantes y si la sección está activa (abierta) o cerrada.
// Incluye "aleatorizar estudiantes" (variable aleatoria por
// grado, acotada por la capacidad física de secciones creadas)
// que abre/cierra secciones para que la nómina de docentes que
// hace falta nunca supere el límite de configuracion_colegio.
// =========================================================
const { pool } = require('../config/db');
const { calcularNecesidadDocentes, balancearNomina } = require('../services/necesidadDocentesService');

function estudiantesAleatorios(cupoMaximo) {
  const minimo = Math.max(1, Math.round(cupoMaximo * 0.75));
  return Math.floor(Math.random() * (cupoMaximo - minimo + 1)) + minimo;
}

// ---------------------------------------------------------
// GET /api/cursos?jornada=&grado=&activo=
// ---------------------------------------------------------
async function consultarTodos(req, res) {
  try {
    const { jornada, grado, activo } = req.query;
    const condiciones = [];
    const parametros = [];
    if (jornada) { condiciones.push('jornada = ?'); parametros.push(jornada); }
    if (grado) { condiciones.push('grado = ?'); parametros.push(grado); }
    if (activo !== undefined) { condiciones.push('activo = ?'); parametros.push(activo === 'true' ? 1 : 0); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [cursos] = await pool.query(
      `SELECT id, grado, seccion, jornada, cupo_maximo, estudiantes, activo
       FROM cursos ${where}
       ORDER BY grado, seccion`,
      parametros
    );
    return res.status(200).json(cursos);
  } catch (error) {
    console.error('Error en consultarTodos() [cursos]:', error);
    return res.status(500).json({ mensaje: 'Error interno al consultar los cursos.' });
  }
}

// ---------------------------------------------------------
// GET /api/cursos/:id  (incluye su horario semanal completo)
// ---------------------------------------------------------
async function consultarPorId(req, res) {
  try {
    const { id } = req.params;
    const [cursos] = await pool.query('SELECT * FROM cursos WHERE id = ?', [id]);
    if (cursos.length === 0) {
      return res.status(404).json({ mensaje: 'Curso no encontrado.' });
    }
    const [horario] = await pool.query(
      `SELECT h.id, h.dia, h.hora_inicio, h.hora_fin, m.nombre AS materia,
              h.docente_id, d.nombre AS docente_nombre
       FROM horarios h
       JOIN materias m ON m.id = h.materia_id
       LEFT JOIN docentes d ON d.id = h.docente_id
       WHERE h.curso_id = ?
       ORDER BY FIELD(h.dia, 'Lunes','Martes','Miercoles','Jueves','Viernes'), h.hora_inicio`,
      [id]
    );
    return res.status(200).json({ ...cursos[0], horario });
  } catch (error) {
    console.error('Error en consultarPorId() [cursos]:', error);
    return res.status(500).json({ mensaje: 'Error interno al consultar el curso.' });
  }
}

// ---------------------------------------------------------
// POST /api/cursos
// ---------------------------------------------------------
async function crear(req, res) {
  try {
    const { grado, seccion, jornada, cupoMaximo, estudiantes } = req.body;
    if (!grado || !seccion || !jornada || !cupoMaximo) {
      return res.status(400).json({ mensaje: 'grado, seccion, jornada y cupoMaximo son obligatorios.' });
    }
    const cantidadEstudiantes = estudiantes !== undefined ? estudiantes : estudiantesAleatorios(cupoMaximo);
    const [resultado] = await pool.query(
      'INSERT INTO cursos (grado, seccion, jornada, cupo_maximo, estudiantes) VALUES (?, ?, ?, ?, ?)',
      [grado, seccion, jornada, cupoMaximo, cantidadEstudiantes]
    );
    const [creado] = await pool.query('SELECT * FROM cursos WHERE id = ?', [resultado.insertId]);
    return res.status(201).json(creado[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe un curso con ese grado y sección.' });
    }
    console.error('Error en crear() [cursos]:', error);
    return res.status(500).json({ mensaje: 'Error interno al crear el curso.' });
  }
}

// ---------------------------------------------------------
// PUT /api/cursos/:id
// ---------------------------------------------------------
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { grado, seccion, jornada, cupoMaximo, estudiantes } = req.body;
    const [resultado] = await pool.query(
      'UPDATE cursos SET grado = ?, seccion = ?, jornada = ?, cupo_maximo = ?, estudiantes = ? WHERE id = ?',
      [grado, seccion, jornada, cupoMaximo, estudiantes, id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Curso no encontrado.' });
    }
    const [actualizado] = await pool.query('SELECT * FROM cursos WHERE id = ?', [id]);
    return res.status(200).json(actualizado[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe un curso con ese grado y sección.' });
    }
    if (error.errno === 3819) { // CHECK constraint (estudiantes > cupo_maximo)
      return res.status(422).json({ mensaje: 'El número de estudiantes no puede superar el cupo máximo.' });
    }
    console.error('Error en actualizar() [cursos]:', error);
    return res.status(500).json({ mensaje: 'Error interno al actualizar el curso.' });
  }
}

// ---------------------------------------------------------
// DELETE /api/cursos/:id (borra en cascada su horario)
// ---------------------------------------------------------
async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const [resultado] = await pool.query('DELETE FROM cursos WHERE id = ?', [id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Curso no encontrado.' });
    }
    return res.status(200).json({ mensaje: 'Curso eliminado correctamente.', id: Number(id) });
  } catch (error) {
    console.error('Error en eliminar() [cursos]:', error);
    return res.status(500).json({ mensaje: 'Error interno al eliminar el curso.' });
  }
}

// ---------------------------------------------------------
// POST /api/cursos/aleatorizar-estudiantes
// Para cada grado, sortea una matrícula total acotada entre el
// 50% y el 100% de la capacidad física del grado (secciones ya
// creadas x cupo máximo), calcula cuántas secciones hacen falta
// para esa matrícula (sin superar las secciones creadas) y
// abre/cierra secciones en consecuencia. Las secciones que se
// cierran quedan con 0 estudiantes y sus bloques de horario se
// vacían (docente_id = NULL): así la nómina que hace falta nunca
// supera el límite de docentes disponibles, y quien reabra una
// sección después la cubre desde "Bloques vacantes".
//
// Después de recalcular los cursos, balancea la nómina de docentes
// activos por área (ver balancearNomina en necesidadDocentesService):
// desactiva a los que sobran y reactiva a los que faltan, todo
// dentro de la misma transacción.
// ---------------------------------------------------------
const FRACCION_MINIMA_MATRICULA = 0.5;

async function aleatorizarEstudiantes(req, res) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    const [grados] = await conexion.query(
      'SELECT grado, COUNT(*) AS secciones, MAX(cupo_maximo) AS cupo FROM cursos GROUP BY grado ORDER BY grado'
    );

    const resumenPorGrado = [];
    for (const fila of grados) {
      // eslint-disable-next-line no-await-in-loop
      const [secciones] = await conexion.query(
        'SELECT id, seccion FROM cursos WHERE grado = ? ORDER BY seccion',
        [fila.grado]
      );

      const capacidadTotal = fila.secciones * fila.cupo;
      const minimo = Math.round(capacidadTotal * FRACCION_MINIMA_MATRICULA);
      const totalEstudiantes = minimo + Math.floor(Math.random() * (capacidadTotal - minimo + 1));
      const seccionesNecesarias = Math.min(fila.secciones, Math.max(1, Math.ceil(totalEstudiantes / fila.cupo)));

      let restante = totalEstudiantes;
      const actualizaciones = secciones.map((seccion, indice) => {
        if (indice >= seccionesNecesarias) {
          return { id: seccion.id, activo: false, estudiantes: 0 };
        }
        const seccionesQueQuedan = seccionesNecesarias - indice;
        const estudiantesSeccion = Math.max(0, Math.min(fila.cupo, Math.round(restante / seccionesQueQuedan)));
        restante -= estudiantesSeccion;
        return { id: seccion.id, activo: true, estudiantes: estudiantesSeccion };
      });

      for (const c of actualizaciones) {
        // eslint-disable-next-line no-await-in-loop
        await conexion.query(
          'UPDATE cursos SET activo = ?, estudiantes = ? WHERE id = ?',
          [c.activo, c.estudiantes, c.id]
        );
      }

      const idsCerrados = actualizaciones.filter((c) => !c.activo).map((c) => c.id);
      if (idsCerrados.length) {
        // eslint-disable-next-line no-await-in-loop
        await conexion.query('UPDATE horarios SET docente_id = NULL WHERE curso_id IN (?) AND docente_id IS NOT NULL', [idsCerrados]);
      }

      resumenPorGrado.push({
        grado: fila.grado,
        seccionesTotales: fila.secciones,
        seccionesActivas: seccionesNecesarias,
        cupoMaximo: fila.cupo,
        estudiantes: totalEstudiantes,
      });
    }

    const balanceNomina = await balancearNomina(conexion);

    await conexion.commit();

    const [cursosActualizados] = await pool.query('SELECT * FROM cursos ORDER BY grado, seccion');
    const necesidad = await calcularNecesidadDocentes();

    return res.status(200).json({
      cursos: cursosActualizados,
      porGrado: resumenPorGrado,
      necesidadDocentes: necesidad,
      docentesDesactivados: balanceNomina.desactivados,
      docentesReactivados: balanceNomina.reactivados,
    });
  } catch (error) {
    await conexion.rollback();
    console.error('Error en aleatorizarEstudiantes():', error);
    return res.status(500).json({ mensaje: 'Error interno al aleatorizar los estudiantes.' });
  } finally {
    conexion.release();
  }
}

module.exports = {
  consultarTodos,
  consultarPorId,
  crear,
  actualizar,
  eliminar,
  aleatorizarEstudiantes,
};
