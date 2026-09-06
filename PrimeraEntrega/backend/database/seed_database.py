import asyncio
import csv
import os
import random
import unicodedata
from pathlib import Path

import aiomysql
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_DIR / "database" / "seed" / "data"
load_dotenv(BACKEND_DIR / ".env")

AREAS = {
    "MAT-FIS": "Matemáticas y Física",
    "ESP-ING": "Español e Inglés",
    "CIENCIAS": "Ciencias Naturales (Biología / Química)",
    "EDF-ETICA": "Educación Física y Ética",
    "FLEX": "Informática, Sociales y Filosofía",
}
LEVEL_RANGES = {
    "Primaria (1°–5°)": (1, 5),
    "Bachillerato (6°–10°)": (6, 10),
    "Grado 11°": (11, 11),
}
DAY_NAMES = {"Miércoles": "Miercoles"}
SHIFT_NAMES = {"Mañana": "Manana", "Tarde": "Tarde"}


def read_csv(filename):
    with (DATA_DIR / filename).open(encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def normalize_text(value):
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(char for char in normalized if not unicodedata.combining(char))


def parse_time_range(value):
    start, end = value.replace("-", "–").split("–", 1)
    def normalize_time(raw):
        hour, minute = raw.strip().split(":")
        return f"{int(hour):02d}:{int(minute):02d}:00"
    return normalize_time(start), normalize_time(end)


def students_for_capacity(capacity):
    minimum = max(1, round(capacity * 0.75))
    return random.randint(minimum, capacity)


async def seed():
    random.seed(2026)
    courses = read_csv("cursos.csv")
    teachers = read_csv("docentes.csv")
    plans = [row for row in read_csv("plan_materias.csv") if row["Bloques_semana"] != "—"]
    schedules = read_csv("horarios.csv")

    pool = await aiomysql.create_pool(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        db=os.getenv("DB_NAME", "notasAcademicas"),
        autocommit=False,
    )

    try:
        async with pool.acquire() as connection:
            async with connection.cursor(aiomysql.DictCursor) as cursor:
                await cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
                for table in ("horarios", "docentes", "cursos", "plan_materias", "materias", "areas"):
                    await cursor.execute(f"TRUNCATE TABLE {table}")
                await cursor.execute("SET FOREIGN_KEY_CHECKS = 1")

                area_ids = {}
                for code, name in AREAS.items():
                    await cursor.execute("INSERT INTO areas (codigo, nombre) VALUES (%s, %s)", (code, name))
                    area_ids[code] = cursor.lastrowid

                subject_areas = {}
                for row in plans:
                    if row["Materia"].startswith("(biblioteca:"):
                        continue
                    subject_areas.setdefault(row["Materia"], row["Responsable"])
                for row in schedules:
                    subject_areas.setdefault(row["Materia"], row["Área"])

                subject_ids = {}
                for subject, area_code in subject_areas.items():
                    await cursor.execute("INSERT INTO materias (nombre, area_id) VALUES (%s, %s)", (subject, area_ids.get(area_code)))
                    subject_ids[subject] = cursor.lastrowid

                for row in plans:
                    if row["Materia"].startswith("(biblioteca:"):
                        continue
                    degree_min, degree_max = LEVEL_RANGES.get(row["Nivel"], (1, 11))
                    await cursor.execute(
                        "INSERT INTO plan_materias (nivel, grado_min, grado_max, materia_id, bloques_semana, horas_semana) VALUES (%s,%s,%s,%s,%s,%s)",
                        (row["Nivel"], degree_min, degree_max, subject_ids[row["Materia"]], int(row["Bloques_semana"]), float(row["Horas_semana"])),
                    )

                for row in courses:
                    capacity = int(row["Máx. estudiantes"])
                    await cursor.execute(
                        "INSERT INTO cursos (id, grado, seccion, jornada, cupo_maximo, estudiantes) VALUES (%s,%s,%s,%s,%s,%s)",
                        (int(row["Curso_ID"]), int(row["Grado"]), row["Sección"], SHIFT_NAMES.get(row["Jornada"].split()[0], row["Jornada"].split()[0]), capacity, students_for_capacity(capacity)),
                    )

                for row in teachers:
                    area_code = row["Docente_ID"].rsplit("-", 1)[0]
                    hours = float(row["Horas_trabajo_semana"] or 34.5)
                    await cursor.execute(
                        "INSERT INTO docentes (id, nombre, area_id, horas_contratadas, activo) VALUES (%s,%s,%s,%s,TRUE)",
                        (row["Docente_ID"], row["Nombre"], area_ids.get(area_code), hours),
                    )

                for row in schedules:
                    start, end = parse_time_range(row["Hora"])
                    await cursor.execute(
                        "INSERT INTO horarios (curso_id, materia_id, docente_id, dia, hora_inicio, hora_fin) VALUES (%s,%s,%s,%s,%s,%s)",
                        (int(row["Curso_ID"]), subject_ids[row["Materia"]], row["Docente_ID"], DAY_NAMES.get(row["Día"], normalize_text(row["Día"])), start, end),
                    )
                await connection.commit()
                print(f"Carga completa: {len(courses)} cursos, {len(teachers)} docentes, {len(subject_ids)} materias y {len(schedules)} horarios.")
    except Exception:
        async with pool.acquire() as connection:
            await connection.rollback()
        raise
    finally:
        pool.close()
        await pool.wait_closed()


if __name__ == "__main__":
    asyncio.run(seed())
