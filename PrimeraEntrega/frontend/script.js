const API_URL = 'api/estudiantes';

/* PROGRAMACIÓN ORIENTADA A OBJETOS
   Clase Estudiante: datos académicos y la
    lógica de cálculo/clasificación de un estudiante. */
class Estudiante {
  constructor(nombre, nota1, nota2, nota3, nota4, id = null) {
    this.id = id;
    this.nombre = nombre;
    this.nota1 = Number(nota1);
    this.nota2 = Number(nota2);
    this.nota3 = Number(nota3);
    this.nota4 = Number(nota4);
    this.promedio = this.calcularPromedio();
    this.estado = this.determinarAprobacion();
    this.rendimiento = this.determinarRendimientoCualitativo();
  }

  // Calcula el promedio de las cuatro notas, redondeado a 1 decimal
  calcularPromedio() {
    const suma = this.nota1 + this.nota2 + this.nota3 + this.nota4;
    return Math.round((suma / 4) * 10) / 10;
  }

  // Determina si el estudiante aprobó (promedio >= 3.0)
  determinarAprobacion() {
    return this.promedio >= 3.0 ? 'Aprobado' : 'No aprobado';
  }

  // Determina la valoración cualitativa según la tabla de la guía
  determinarRendimientoCualitativo() {
    const p = this.promedio;
    if (p >= 0.0 && p <= 2.9) return 'Rendimiento insuficiente';
    if (p >= 3.0 && p <= 3.9) return 'Aprobado';
    if (p >= 4.0 && p <= 4.5) return 'Aprobado con sobresaliente';
    if (p >= 4.6 && p <= 5.0) return 'Aprobado con excelente';
    return 'Sin clasificar';
  }

  // Devuelve una clase CSS según el nivel de rendimiento (para el badge)
  claseBadge() {
    if (this.promedio < 3.0) return 'badge badge--insufficient';
    if (this.promedio < 4.0) return 'badge';
    return 'badge badge--outstanding';
  }

  // Representación plana para enviar/recibir de la API
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

  // Crea una instancia de Estudiante a partir de un registro de la BD
  static fromRegistro(r) {
    const e = new Estudiante(r.nombre, r.nota1, r.nota2, r.nota3, r.nota4, r.id);
    return e;
  }
}

const form = document.getElementById('form-notas');
const inputNombre = document.getElementById('nombre-estudiante');
const errorNombre = document.getElementById('error-nombre');

const notaIds = ['nota-1', 'nota-2', 'nota-3', 'nota-4'];
const inputsNotas = notaIds.map(id => document.getElementById(id));
const erroresNotas = notaIds.map(id => document.getElementById(`error-${id}`));

const btnGuardar = document.getElementById('btn-guardar');

const areaResultados = document.getElementById('area-resultados');
const resultEmpty = areaResultados.querySelector('.result-slip__empty');
const resultData = areaResultados.querySelector('.result-slip__data');
// orden en que aparecen: Estudiante, Promedio, Estado(badge), Rendimiento
const [ddNombre, ddPromedio, ddEstado, ddRendimiento] =
  resultData.querySelectorAll('.result-slip__row dd');

const cuerpoTabla = document.getElementById('cuerpo-tabla-registros');

// Estado interno: si estamos editando un registro existente, guarda su id
let idEnEdicion = null;

/* VALIDACIONES */
function limpiarErrores() {
  errorNombre.hidden = true;
  inputNombre.removeAttribute('aria-invalid');
  erroresNotas.forEach((el, i) => {
    el.hidden = true;
    inputsNotas[i].removeAttribute('aria-invalid');
  });
}

function mostrarError(input, errorEl, mensaje) {
  errorEl.textContent = mensaje;
  errorEl.hidden = false;
  input.setAttribute('aria-invalid', 'true');
}

// Valida el formulario completo
function validarFormulario() {
  limpiarErrores();
  let valido = true;

  const nombre = inputNombre.value.trim();
  if (!nombre) {
    mostrarError(inputNombre, errorNombre, 'Ingresa el nombre del estudiante para continuar.');
    valido = false;
  }

  inputsNotas.forEach((input, i) => {
    const valorTexto = input.value.trim();
    const valor = Number(valorTexto);

    if (valorTexto === '' || Number.isNaN(valor)) {
      mostrarError(input, erroresNotas[i], 'Ingresa un valor numérico entre 0.0 y 5.0.');
      valido = false;
    } else if (valor < 0 || valor > 5) {
      mostrarError(input, erroresNotas[i], 'Ingresa un valor entre 0.0 y 5.0.');
      valido = false;
    }
  });

  return valido;
}

/* CÁLCULO Y PRESENTACIÓN DEL RESULTADO */
function construirEstudianteDesdeFormulario() {
  return new Estudiante(
    inputNombre.value.trim(),
    inputsNotas[0].value,
    inputsNotas[1].value,
    inputsNotas[2].value,
    inputsNotas[3].value,
    idEnEdicion
  );
}

function mostrarResultado(estudiante) {
  resultEmpty.hidden = true;
  resultData.hidden = false;

  ddNombre.textContent = estudiante.nombre;
  ddPromedio.textContent = estudiante.promedio.toFixed(1);

  ddEstado.innerHTML = `<span class="${estudiante.claseBadge()}">${estudiante.estado}</span>`;
  ddRendimiento.textContent = estudiante.rendimiento;
}

// Botón "Calcular promedio": solo calcula y muestra, no guarda
form.addEventListener('submit', (evento) => {
  evento.preventDefault();
  if (!validarFormulario()) return;

  const estudiante = construirEstudianteDesdeFormulario();
  mostrarResultado(estudiante);
});

/* RETROALIMENTACIÓN AL USUARIO (UX) */
function notificar(mensaje, tipo = 'info') {
  const aviso = document.createElement('p');
  aviso.className = 'field__help';
  aviso.style.marginTop = '0.75rem';
  aviso.style.fontWeight = '600';
  aviso.style.color = tipo === 'error' ? 'var(--accent)' : 'var(--approved)';
  aviso.textContent = mensaje;
  areaResultados.appendChild(aviso);
  setTimeout(() => aviso.remove(), 4000);
}

/* CRUD — Comunicación con el backend (Java) */
async function obtenerRegistros() {
  const resp = await fetch(API_URL);
  if (!resp.ok) throw new Error('No se pudieron cargar los registros.');
  return resp.json();
}

async function crearRegistro(estudiante) {
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(estudiante.toJSON()),
  });
  if (!resp.ok) throw new Error('No se pudo guardar el registro.');
  return resp.json();
}

async function actualizarRegistro(estudiante) {
  const resp = await fetch(`${API_URL}/${estudiante.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(estudiante.toJSON()),
  });
  if (!resp.ok) throw new Error('No se pudo actualizar el registro.');
  return resp.json();
}

async function eliminarRegistro(id) {
  const resp = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
  if (!resp.ok) throw new Error('No se pudo eliminar el registro.');
  return resp.json();
}

/* TABLA DE REGISTROS */
function renderTabla(registros) {
  cuerpoTabla.innerHTML = '';

  if (!registros || registros.length === 0) {
    cuerpoTabla.innerHTML = `
      <tr class="records-table__empty-row">
        <td colspan="8">Todavía no hay estudiantes registrados. Los registros guardados se listarán en esta tabla.</td>
      </tr>`;
    return;
  }

  registros.forEach((r) => {
    const e = Estudiante.fromRegistro(r);
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${e.nombre}</td>
      <td>${e.nota1.toFixed(1)}</td>
      <td>${e.nota2.toFixed(1)}</td>
      <td>${e.nota3.toFixed(1)}</td>
      <td>${e.nota4.toFixed(1)}</td>
      <td>${e.promedio.toFixed(1)}</td>
      <td>${e.rendimiento}</td>
      <td>
        <button type="button" class="btn btn--secondary btn--fila" data-accion="editar" data-id="${e.id}">Editar</button>
        <button type="button" class="btn btn--secondary btn--fila" data-accion="eliminar" data-id="${e.id}">Eliminar</button>
      </td>`;
    cuerpoTabla.appendChild(fila);
  });
}

async function refrescarTabla() {
  try {
    const registros = await obtenerRegistros();
    renderTabla(registros);
  } catch (err) {
    notificar(err.message, 'error');
  }
}

/* GUARDAR  */
btnGuardar.addEventListener('click', async () => {
  if (!validarFormulario()) return;

  const estudiante = construirEstudianteDesdeFormulario();
  mostrarResultado(estudiante);

  try {
    if (idEnEdicion) {
      await actualizarRegistro(estudiante);
      notificar('Registro actualizado correctamente.');
    } else {
      await crearRegistro(estudiante);
      notificar('Estudiante guardado correctamente.');
    }
    salirModoEdicion();
    form.reset();
    await refrescarTabla();
  } catch (err) {
    notificar(err.message, 'error');
  }
});

function entrarModoEdicion(registro) {
  idEnEdicion = registro.id;
  inputNombre.value = registro.nombre;
  inputsNotas[0].value = registro.nota1;
  inputsNotas[1].value = registro.nota2;
  inputsNotas[2].value = registro.nota3;
  inputsNotas[3].value = registro.nota4;
  btnGuardar.textContent = 'Actualizar registro';
  inputNombre.focus();
}

function salirModoEdicion() {
  idEnEdicion = null;
  btnGuardar.textContent = 'Guardar registro';
}

/* ACCIONES DE LA TABLA (editar / eliminar)*/
cuerpoTabla.addEventListener('click', async (evento) => {
  const boton = evento.target.closest('button[data-accion]');
  if (!boton) return;

  const id = boton.dataset.id;
  const accion = boton.dataset.accion;

  if (accion === 'eliminar') {
    const confirmado = confirm('¿Seguro que deseas eliminar este registro?');
    if (!confirmado) return;
    try {
      await eliminarRegistro(id);
      notificar('Registro eliminado.');
      await refrescarTabla();
    } catch (err) {
      notificar(err.message, 'error');
    }
    return;
  }

  if (accion === 'editar') {
    try {
      const registros = await obtenerRegistros();
      const registro = registros.find(r => String(r.id) === String(id));
      if (registro) entrarModoEdicion(registro);
    } catch (err) {
      notificar(err.message, 'error');
    }
  }
});

/* CARGA INICIAL */
document.addEventListener('DOMContentLoaded', refrescarTabla);