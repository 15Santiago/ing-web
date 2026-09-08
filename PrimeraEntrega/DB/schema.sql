create database notasAcademicas;

use notasAcademicas;

create table Estudiantes (
id int auto_increment primary key,
nombre varchar(150),
nota1 decimal(3,1),
nota2 decimal(3,1),
nota3 decimal(3,1),
nota4 decimal(3,1),
promedio decimal(3,1),
estado varchar(20),
rendimiento varchar(40),
creado_en timestamp,


CONSTRAINT chk_nota1 CHECK (nota1 BETWEEN 0.0 AND 5.0),
CONSTRAINT chk_nota2 CHECK (nota2 BETWEEN 0.0 AND 5.0),
CONSTRAINT chk_nota3 CHECK (nota3 BETWEEN 0.0 AND 5.0),
CONSTRAINT chk_nota4 CHECK (nota4 BETWEEN 0.0 AND 5.0)

);

/* ================================================================
   PROGRAMACION ACADEMICA (cursos, docentes, asignaturas, horarios)
   Modela la planta real del colegio: 42 cursos, maximo 30 docentes
   y el horario semanal bloque a bloque (bloques de 45 min, sin
   horas de trabajo autonomo: todo bloque es una clase real). Los
   datos se cargan desde seed/data/*.csv (extraidos de
   Horario_Colegio.xlsx) con seed/seed.js (corre "npm run seed"
   desde PrimeraEntrega/backend).

   Jornada manana 7:00-12:00 y tarde 13:00-18:00 (5 horas cada una,
   con un receso de 30 min a la mitad); un docente de tiempo
   completo trabaja 8 horas diarias con 1 hora de almuerzo (35 h/
   semana nominales; el maximo real de clase es 34.5 h = 46
   bloques, dejando margen para preparacion/coordinacion).

   El numero de estudiantes matriculados por curso es una variable
   aleatoria acotada por el cupo maximo del curso (columna
   "estudiantes" de la tabla cursos). Cada grado tiene mas secciones
   fisicas creadas (filas en cursos) de las que siempre hacen falta;
   "activo" indica si esa seccion esta actualmente en funcionamiento.
   POST /api/cursos/aleatorizar-estudiantes recalcula, por grado,
   cuantas secciones necesita una matricula total aleatoria (sin
   superar el numero de secciones ya creadas para ese grado) y
   abre/cierra secciones en consecuencia, de forma que la nomina de
   docentes que hace falta nunca supere los 30 definidos en
   configuracion_colegio.capacidad_nomina.
   ================================================================ */

CREATE TABLE configuracion_colegio (
	id INT AUTO_INCREMENT PRIMARY KEY,
	nombre VARCHAR(150) NOT NULL,
	capacidad_nomina INT NOT NULL DEFAULT 30,
	horas_jornada_diaria DECIMAL(4,2) NOT NULL DEFAULT 4.5,
	horas_trabajo_diarias_docente INT NOT NULL DEFAULT 8,
	horas_almuerzo_diarias_docente INT NOT NULL DEFAULT 1,
	dias_laborales_semana INT NOT NULL DEFAULT 5,
	minutos_receso INT NOT NULL DEFAULT 30,
	bloques_max_docente_semana INT NOT NULL DEFAULT 46,
	CONSTRAINT chk_capacidad_nomina CHECK (capacidad_nomina > 0),
	CONSTRAINT chk_horas_jornada CHECK (horas_jornada_diaria > 0),
	CONSTRAINT chk_horas_docente CHECK (
		horas_trabajo_diarias_docente > horas_almuerzo_diarias_docente
	)
);

INSERT INTO configuracion_colegio (nombre) VALUES ('Colegio Distrital');

CREATE TABLE areas (
	id INT AUTO_INCREMENT PRIMARY KEY,
	codigo VARCHAR(20) NOT NULL UNIQUE,
	nombre VARCHAR(100) NOT NULL
);

CREATE TABLE materias (
	id INT AUTO_INCREMENT PRIMARY KEY,
	nombre VARCHAR(80) NOT NULL UNIQUE,
	area_id INT NULL,
	FOREIGN KEY (area_id) REFERENCES areas(id)
);

/* Intensidad horaria de cada asignatura, por nivel (algunas
   materias tienen distinta carga en primaria/bachillerato/11). */
CREATE TABLE plan_materias (
	id INT AUTO_INCREMENT PRIMARY KEY,
	nivel VARCHAR(40) NOT NULL,
	grado_min TINYINT NOT NULL,
	grado_max TINYINT NOT NULL,
	materia_id INT NOT NULL,
	bloques_semana INT NOT NULL,
	horas_semana DECIMAL(5,2) NOT NULL,
	FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE,
	UNIQUE (nivel, materia_id),
	CONSTRAINT chk_plan_grados CHECK (grado_min BETWEEN 1 AND 11 AND grado_max BETWEEN grado_min AND 11)
);

CREATE TABLE cursos (
	id INT AUTO_INCREMENT PRIMARY KEY,
	grado TINYINT NOT NULL,
	seccion CHAR(1) NOT NULL,
	jornada ENUM('Manana', 'Tarde') NOT NULL,
	cupo_maximo INT NOT NULL,
	estudiantes INT NOT NULL,
	activo BOOLEAN NOT NULL DEFAULT TRUE,
	UNIQUE (grado, seccion),
	CONSTRAINT chk_grado_curso CHECK (grado BETWEEN 1 AND 11),
	CONSTRAINT chk_cupo_curso CHECK (cupo_maximo > 0),
	CONSTRAINT chk_estudiantes_curso CHECK (estudiantes BETWEEN 0 AND cupo_maximo)
);

CREATE TABLE docentes (
	id VARCHAR(20) PRIMARY KEY,
	nombre VARCHAR(150) NOT NULL,
	area_id INT NULL,
	horas_contratadas DECIMAL(5,2) NOT NULL DEFAULT 34.5,
	activo BOOLEAN NOT NULL DEFAULT TRUE,
	fecha_baja DATETIME NULL,
	FOREIGN KEY (area_id) REFERENCES areas(id),
	CONSTRAINT chk_horas_contratadas_docente CHECK (horas_contratadas > 0)
);

/* Un bloque de horario = una materia dictada a un curso, en un
   dia y una franja horaria concreta, por un docente (o vacante si
   docente_id es NULL, p.ej. tras despedir al titular).
   Las llaves UNIQUE evitan por diseno los dos conflictos que pide
   la guia: un docente o un curso con dos clases al mismo tiempo
   (MySQL no compara los NULL de docente_id entre si como iguales,
   asi que varios bloques vacantes en la misma franja no chocan). */
CREATE TABLE horarios (
	id INT AUTO_INCREMENT PRIMARY KEY,
	curso_id INT NOT NULL,
	materia_id INT NOT NULL,
	docente_id VARCHAR(20) NULL,
	dia ENUM('Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes') NOT NULL,
	hora_inicio TIME NOT NULL,
	hora_fin TIME NOT NULL,
	FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE,
	FOREIGN KEY (materia_id) REFERENCES materias(id),
	FOREIGN KEY (docente_id) REFERENCES docentes(id) ON DELETE SET NULL,
	UNIQUE KEY uq_horario_curso (curso_id, dia, hora_inicio),
	UNIQUE KEY uq_horario_docente (docente_id, dia, hora_inicio),
	CONSTRAINT chk_horario_rango CHECK (hora_fin > hora_inicio)
);

CREATE INDEX idx_horarios_materia ON horarios (materia_id);
CREATE INDEX idx_horarios_dia ON horarios (dia);
CREATE INDEX idx_cursos_jornada ON cursos (jornada);
CREATE INDEX idx_cursos_activo ON cursos (activo);
CREATE INDEX idx_docentes_area ON docentes (area_id);