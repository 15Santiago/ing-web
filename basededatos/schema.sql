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
   PLANEACION ACADEMICA ANUAL
   Una plaza docente trabaja 8 horas diarias, incluida 1 hora de
   almuerzo: 35 horas academicas disponibles por semana.
   ================================================================ */

CREATE TABLE configuracion_colegio (
	id INT AUTO_INCREMENT PRIMARY KEY,
	nombre VARCHAR(150) NOT NULL,
	capacidad_nomina INT NOT NULL DEFAULT 30,
	horas_jornada_diaria INT NOT NULL DEFAULT 5,
	horas_trabajo_diarias_docente INT NOT NULL DEFAULT 8,
	horas_almuerzo_diarias_docente INT NOT NULL DEFAULT 1,
	dias_laborales_semana INT NOT NULL DEFAULT 5,
	CONSTRAINT chk_capacidad_nomina CHECK (capacidad_nomina > 0),
	CONSTRAINT chk_horas_jornada CHECK (horas_jornada_diaria > 0),
	CONSTRAINT chk_horas_docente CHECK (
		horas_trabajo_diarias_docente > horas_almuerzo_diarias_docente
	)
);

CREATE TABLE anios_lectivos (
	id INT AUTO_INCREMENT PRIMARY KEY,
	nombre VARCHAR(20) NOT NULL UNIQUE,
	fecha_inicio DATE NOT NULL,
	fecha_fin DATE NOT NULL,
	activo BOOLEAN NOT NULL DEFAULT TRUE,
	CONSTRAINT chk_fechas_anio CHECK (fecha_fin > fecha_inicio)
);

CREATE TABLE jornadas (
	id INT AUTO_INCREMENT PRIMARY KEY,
	nombre ENUM('Manana', 'Tarde') NOT NULL UNIQUE
);

CREATE TABLE grados (
	id INT AUTO_INCREMENT PRIMARY KEY,
	numero TINYINT NOT NULL UNIQUE,
	cursos_totales INT NOT NULL,
	cursos_manana INT NOT NULL,
	estudiantes_por_curso INT NOT NULL,
	CONSTRAINT chk_numero_grado CHECK (numero BETWEEN 1 AND 11),
	CONSTRAINT chk_cursos_grado CHECK (
		cursos_totales > 0 AND cursos_manana BETWEEN 0 AND cursos_totales
	),
	CONSTRAINT chk_estudiantes_grado CHECK (estudiantes_por_curso > 0)
);

CREATE TABLE cursos (
	id INT AUTO_INCREMENT PRIMARY KEY,
	anio_lectivo_id INT NOT NULL,
	grado_id INT NOT NULL,
	jornada_id INT NOT NULL,
	codigo VARCHAR(20) NOT NULL,
	estudiantes INT NOT NULL,
	UNIQUE (anio_lectivo_id, codigo),
	FOREIGN KEY (anio_lectivo_id) REFERENCES anios_lectivos(id),
	FOREIGN KEY (grado_id) REFERENCES grados(id),
	FOREIGN KEY (jornada_id) REFERENCES jornadas(id),
	CONSTRAINT chk_estudiantes_curso CHECK (estudiantes > 0)
);

CREATE TABLE materias (
	id INT AUTO_INCREMENT PRIMARY KEY,
	nombre VARCHAR(80) NOT NULL UNIQUE,
	abreviatura VARCHAR(12) NOT NULL UNIQUE,
	tipo_carga ENUM('Alta', 'Baja') NOT NULL,
	grado_minimo TINYINT NOT NULL DEFAULT 1,
	grado_maximo TINYINT NOT NULL DEFAULT 11,
	CONSTRAINT chk_rango_materia CHECK (
		grado_minimo BETWEEN 1 AND 11 AND grado_maximo BETWEEN grado_minimo AND 11
	)
);

CREATE TABLE plan_materias (
	id INT AUTO_INCREMENT PRIMARY KEY,
	grado_id INT NOT NULL,
	materia_id INT NOT NULL,
	horas_semanales INT NOT NULL,
	UNIQUE (grado_id, materia_id),
	FOREIGN KEY (grado_id) REFERENCES grados(id),
	FOREIGN KEY (materia_id) REFERENCES materias(id),
	CONSTRAINT chk_horas_materia CHECK (horas_semanales >= 0)
);

CREATE TABLE docentes (
	id INT AUTO_INCREMENT PRIMARY KEY,
	nombre VARCHAR(150) NOT NULL,
	especialidad VARCHAR(80),
	horas_contratadas INT NOT NULL DEFAULT 35,
	activo BOOLEAN NOT NULL DEFAULT TRUE,
	CONSTRAINT chk_horas_contratadas CHECK (horas_contratadas > 0)
);

CREATE TABLE asignaciones_docentes (
	id INT AUTO_INCREMENT PRIMARY KEY,
	anio_lectivo_id INT NOT NULL,
	docente_id INT NOT NULL,
	curso_id INT NOT NULL,
	materia_id INT NOT NULL,
	horas_semanales INT NOT NULL,
	UNIQUE (anio_lectivo_id, docente_id, curso_id, materia_id),
	FOREIGN KEY (anio_lectivo_id) REFERENCES anios_lectivos(id),
	FOREIGN KEY (docente_id) REFERENCES docentes(id),
	FOREIGN KEY (curso_id) REFERENCES cursos(id),
	FOREIGN KEY (materia_id) REFERENCES materias(id),
	CONSTRAINT chk_horas_asignacion CHECK (horas_semanales > 0)
);

INSERT INTO configuracion_colegio (nombre)
VALUES ('Colegio Distrital');

INSERT INTO anios_lectivos (nombre, fecha_inicio, fecha_fin)
VALUES ('2026', '2026-01-01', '2026-12-31');

INSERT INTO jornadas (nombre)
VALUES ('Manana'), ('Tarde');

/* El enunciado no indica el total de 7; se toma 3 manana + 3 tarde. */
INSERT INTO grados
	(numero, cursos_totales, cursos_manana, estudiantes_por_curso)
VALUES
	(1, 10, 5, 26),
	(2, 10, 6, 30),
	(3, 9, 5, 30),
	(4, 9, 5, 26),
	(5, 9, 5, 28),
	(6, 6, 3, 30),
	(7, 6, 3, 28),
	(8, 6, 3, 28),
	(9, 5, 2, 28),
	(10, 5, 5, 30),
	(11, 4, 4, 30);

INSERT INTO materias
	(nombre, abreviatura, tipo_carga, grado_minimo, grado_maximo)
VALUES
	('Matematicas', 'MAT', 'Alta', 1, 11),
	('Fisica', 'FIS', 'Alta', 6, 11),
	('Quimica', 'QUI', 'Alta', 6, 11),
	('Biologia', 'BIO', 'Alta', 6, 11),
	('Ingles', 'ING', 'Baja', 1, 11),
	('Espanol', 'ESP', 'Alta', 1, 11),
	('Educacion fisica', 'EDF', 'Baja', 1, 11),
	('Etica', 'ETI', 'Baja', 1, 11),
	('Ciencias sociales', 'SOC', 'Baja', 1, 10),
	('Filosofia', 'FIL', 'Baja', 11, 11),
	('Informatica', 'INF', 'Baja', 1, 11);

/* Cada curso recibe 25 horas semanales: 5 horas por dia, 5 dias. */
INSERT INTO plan_materias (grado_id, materia_id, horas_semanales)
SELECT g.id, m.id,
	CASE
		WHEN g.numero BETWEEN 1 AND 5 THEN
			CASE m.abreviatura
				WHEN 'MAT' THEN 5 WHEN 'ESP' THEN 5 WHEN 'ING' THEN 3
				WHEN 'SOC' THEN 3 WHEN 'EDF' THEN 2 WHEN 'ETI' THEN 1
				WHEN 'INF' THEN 3 ELSE 0
			END
		WHEN g.numero BETWEEN 6 AND 8 THEN
			CASE m.abreviatura
				WHEN 'MAT' THEN 4 WHEN 'FIS' THEN 2 WHEN 'QUI' THEN 2
				WHEN 'BIO' THEN 2 WHEN 'ING' THEN 3 WHEN 'ESP' THEN 4
				WHEN 'EDF' THEN 2 WHEN 'ETI' THEN 1 WHEN 'SOC' THEN 2
				WHEN 'INF' THEN 3 ELSE 0
			END
		WHEN g.numero BETWEEN 9 AND 10 THEN
			CASE m.abreviatura
				WHEN 'MAT' THEN 4 WHEN 'FIS' THEN 3 WHEN 'QUI' THEN 3
				WHEN 'BIO' THEN 3 WHEN 'ING' THEN 3 WHEN 'ESP' THEN 4
				WHEN 'EDF' THEN 2 WHEN 'ETI' THEN 1 WHEN 'SOC' THEN 2
				ELSE 0
			END
		ELSE
			CASE m.abreviatura
				WHEN 'MAT' THEN 4 WHEN 'FIS' THEN 3 WHEN 'QUI' THEN 3
				WHEN 'BIO' THEN 3 WHEN 'ING' THEN 3 WHEN 'ESP' THEN 4
				WHEN 'EDF' THEN 2 WHEN 'ETI' THEN 1 WHEN 'FIL' THEN 2
				ELSE 0
			END
	END
FROM grados g
JOIN materias m ON g.numero BETWEEN m.grado_minimo AND m.grado_maximo;

DELIMITER //

CREATE PROCEDURE generar_cursos_anio(IN p_anio_lectivo_id INT)
BEGIN
	DECLARE grado_actual INT DEFAULT 1;
	DECLARE numero_curso INT;
	DECLARE total_cursos INT;
	DECLARE cursos_manana INT;
	DECLARE estudiantes INT;
	DECLARE grado_id_actual INT;
	DECLARE jornada_manana_id INT;
	DECLARE jornada_tarde_id INT;

	SELECT id INTO jornada_manana_id FROM jornadas WHERE nombre = 'Manana';
	SELECT id INTO jornada_tarde_id FROM jornadas WHERE nombre = 'Tarde';

	WHILE grado_actual <= 11 DO
		SELECT id, cursos_totales, cursos_manana, estudiantes_por_curso
		INTO grado_id_actual, total_cursos, cursos_manana, estudiantes
		FROM grados WHERE numero = grado_actual;
		SET numero_curso = 1;

		WHILE numero_curso <= total_cursos DO
			INSERT INTO cursos
				(anio_lectivo_id, grado_id, jornada_id, codigo, estudiantes)
			VALUES (
				p_anio_lectivo_id,
				grado_id_actual,
				IF(numero_curso <= cursos_manana,
				   jornada_manana_id, jornada_tarde_id),
				CONCAT(grado_actual, '-', CHAR(64 + numero_curso)),
				estudiantes
			);
			SET numero_curso = numero_curso + 1;
		END WHILE;
		SET grado_actual = grado_actual + 1;
	END WHILE;
END//

DELIMITER ;

SET @anio_2026_id = (SELECT id FROM anios_lectivos WHERE nombre = '2026');
CALL generar_cursos_anio(@anio_2026_id);

DROP PROCEDURE generar_cursos_anio;

/* Carga requerida y numero de docentes completos necesarios (35 h/semana). */
CREATE OR REPLACE VIEW v_necesidad_docentes AS
SELECT
	a.id AS anio_lectivo_id,
	a.nombre AS anio_lectivo,
	SUM(pm.horas_semanales) AS horas_academicas_semanales,
	FLOOR((SELECT horas_trabajo_diarias_docente - horas_almuerzo_diarias_docente
		   FROM configuracion_colegio LIMIT 1)
		  * (SELECT dias_laborales_semana FROM configuracion_colegio LIMIT 1))
		AS horas_disponibles_por_docente,
	CEIL(
		SUM(pm.horas_semanales) /
		((SELECT horas_trabajo_diarias_docente - horas_almuerzo_diarias_docente
		  FROM configuracion_colegio LIMIT 1)
		 * (SELECT dias_laborales_semana FROM configuracion_colegio LIMIT 1))
	) AS docentes_necesarios,
	(SELECT capacidad_nomina FROM configuracion_colegio LIMIT 1)
		AS docentes_disponibles,
	GREATEST(
		CEIL(
			SUM(pm.horas_semanales) /
			((SELECT horas_trabajo_diarias_docente - horas_almuerzo_diarias_docente
			  FROM configuracion_colegio LIMIT 1)
			 * (SELECT dias_laborales_semana FROM configuracion_colegio LIMIT 1))
		) - (SELECT capacidad_nomina FROM configuracion_colegio LIMIT 1),
		0
	) AS docentes_faltantes
FROM anios_lectivos a
JOIN cursos c ON c.anio_lectivo_id = a.id
JOIN grados g ON g.id = c.grado_id
JOIN plan_materias pm ON pm.grado_id = g.id
GROUP BY a.id, a.nombre;

CREATE OR REPLACE VIEW v_carga_docentes AS
SELECT
	d.id AS docente_id,
	d.nombre AS docente,
	d.horas_contratadas,
	COALESCE(SUM(ad.horas_semanales), 0) AS horas_asignadas,
	d.horas_contratadas - COALESCE(SUM(ad.horas_semanales), 0)
		AS horas_disponibles,
	CASE
		WHEN COALESCE(SUM(ad.horas_semanales), 0) > d.horas_contratadas
			THEN 'Sobrecarga'
		WHEN COALESCE(SUM(ad.horas_semanales), 0) = d.horas_contratadas
			THEN 'Completa'
		ELSE 'Disponible'
	END AS estado_carga
FROM docentes d
LEFT JOIN asignaciones_docentes ad ON ad.docente_id = d.id
GROUP BY d.id, d.nombre, d.horas_contratadas;