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

)