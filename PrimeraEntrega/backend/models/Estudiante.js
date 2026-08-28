// =========================================================
// Clase Estudiante (backend)
// Misma lógica que la clase Estudiante del front end
// (script.js), para que el servidor recalcule y valide todo
// de forma independiente antes de tocar la base de datos.
// Nombres de campos alineados con el front: "rendimiento"
// (no "resultadoCualitativo") y "estado".
// =========================================================

class Estudiante {
  constructor(nombre, nota1, nota2, nota3, nota4, id = null) {
    this.id = id;
    this.nombre = nombre;
    this.nota1 = parseFloat(nota1);
    this.nota2 = parseFloat(nota2);
    this.nota3 = parseFloat(nota3);
    this.nota4 = parseFloat(nota4);
    this.promedio = null;
    this.estado = null;       // 'Aprobado' / 'No aprobado'
    this.rendimiento = null;  // Texto según la escala de la guía
  }

  // ---------------------------------------------------------
  // Validación de las 4 notas (requisito 11 de la guía)
  // Retorna un arreglo de errores; vacío si todo está bien.
  // ---------------------------------------------------------
  validar() {
    const errores = [];
    const notas = { nota1: this.nota1, nota2: this.nota2, nota3: this.nota3, nota4: this.nota4 };

    if (!this.nombre || this.nombre.trim().length === 0) {
      errores.push('El nombre del estudiante es obligatorio.');
    }

    for (const [campo, valor] of Object.entries(notas)) {
      if (valor === null || valor === undefined || Number.isNaN(valor)) {
        errores.push(`El campo ${campo} es obligatorio y debe ser numérico.`);
      } else if (valor < 0.0 || valor > 5.0) {
        errores.push(`El campo ${campo} debe estar entre 0.0 y 5.0 (valor recibido: ${valor}).`);
      }
    }

    return errores;
  }

  // ---------------------------------------------------------
  // Calcula el promedio de las 4 notas (mismo criterio que el
  // front: redondeo a 1 decimal)
  // ---------------------------------------------------------
  calcularPromedio() {
    const suma = this.nota1 + this.nota2 + this.nota3 + this.nota4;
    this.promedio = Math.round((suma / 4) * 10) / 10;
    return this.promedio;
  }

  // ---------------------------------------------------------
  // Determina si el estudiante aprueba (promedio >= 3.0)
  // ---------------------------------------------------------
  determinarAprobacion() {
    if (this.promedio === null) this.calcularPromedio();
    this.estado = this.promedio >= 3.0 ? 'Aprobado' : 'No aprobado';
    return this.estado;
  }

  // ---------------------------------------------------------
  // Determina el rendimiento cualitativo según la escala
  // de la guía (requisito 3):
  //   0.0 - 2.9  -> Rendimiento insuficiente
  //   3.0 - 3.9  -> Aprobado
  //   4.0 - 4.5  -> Aprobado con sobresaliente
  //   4.6 - 5.0  -> Aprobado con excelente
  // ---------------------------------------------------------
  determinarRendimiento() {
    if (this.promedio === null) this.calcularPromedio();
    const p = this.promedio;

    if (p >= 0.0 && p <= 2.9) this.rendimiento = 'Rendimiento insuficiente';
    else if (p >= 3.0 && p <= 3.9) this.rendimiento = 'Aprobado';
    else if (p >= 4.0 && p <= 4.5) this.rendimiento = 'Aprobado con sobresaliente';
    else if (p >= 4.6 && p <= 5.0) this.rendimiento = 'Aprobado con excelente';

    return this.rendimiento;
  }

  // ---------------------------------------------------------
  // Ejecuta todo el proceso de evaluación de una sola vez
  // ---------------------------------------------------------
  procesar() {
    this.calcularPromedio();
    this.determinarAprobacion();
    this.determinarRendimiento();
    return this.toJSON();
  }

  // ---------------------------------------------------------
  // Objeto plano con los MISMOS nombres de campo que usa el
  // front end (script.js -> Estudiante.toJSON()).
  // ---------------------------------------------------------
  toJSON() {
    return {
      id: this.id,
      nombre: this.nombre,
      nota1: this.nota1,
      nota2: this.nota2,
      nota3: this.nota3,
      nota4: this.nota4,
      promedio: this.promedio,
      estado: this.estado,
      rendimiento: this.rendimiento,
    };
  }

  // ---------------------------------------------------------
  // Crea un Estudiante a partir de una fila de la tabla
  // "Estudiantes" en MySQL.
  // ---------------------------------------------------------
  static fromRow(row) {
    const est = new Estudiante(row.nombre, row.nota1, row.nota2, row.nota3, row.nota4, row.id);
    est.promedio = parseFloat(row.promedio);
    est.estado = row.estado;
    est.rendimiento = row.rendimiento;
    return est;
  }
}

module.exports = Estudiante;
