from fastapi import APIRouter, HTTPException

from ..database import connection
from ..common import fetch_all, fetch_one, sql_error, student_result
from ..schemas import StudentPayload

router = APIRouter(prefix="/api/estudiantes", tags=["estudiantes"])


@router.post("/calcular")
async def calculate_student(payload: StudentPayload):
    return student_result(payload)


@router.get("")
async def list_students():
    try:
        async with connection() as (_, cursor):
            rows = await fetch_all(cursor, "SELECT * FROM Estudiantes ORDER BY creado_en DESC, id DESC")
        fields = ("id", "nombre", "nota1", "nota2", "nota3", "nota4", "promedio", "estado", "rendimiento")
        return [{key: row.get(key) for key in fields} for row in rows]
    except Exception as error:
        raise sql_error(error, "Error interno al consultar los registros.") from error


@router.get("/{student_id}")
async def get_student(student_id: int):
    try:
        async with connection() as (_, cursor):
            row = await fetch_one(cursor, "SELECT * FROM Estudiantes WHERE id = %s", (student_id,))
        if not row:
            raise HTTPException(404, "Estudiante no encontrado.")
        fields = ("id", "nombre", "nota1", "nota2", "nota3", "nota4", "promedio", "estado", "rendimiento")
        return {key: row.get(key) for key in fields}
    except HTTPException:
        raise
    except Exception as error:
        raise sql_error(error, "Error interno al consultar el estudiante.") from error


@router.post("", status_code=201)
async def create_student(payload: StudentPayload):
    student = student_result(payload)
    try:
        async with connection() as (_, cursor):
            values = tuple(student[key] for key in ("nombre", "nota1", "nota2", "nota3", "nota4", "promedio", "estado", "rendimiento"))
            await cursor.execute("INSERT INTO Estudiantes (nombre, nota1, nota2, nota3, nota4, promedio, estado, rendimiento, creado_en) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW())", values)
            student["id"] = cursor.lastrowid
        return student
    except Exception as error:
        raise sql_error(error, "Error interno al registrar el estudiante.") from error


@router.put("/{student_id}")
async def update_student(student_id: int, payload: StudentPayload):
    student = student_result(payload, student_id)
    try:
        async with connection() as (_, cursor):
            if not await fetch_one(cursor, "SELECT id FROM Estudiantes WHERE id = %s", (student_id,)):
                raise HTTPException(404, "Estudiante no encontrado.")
            values = tuple(student[key] for key in ("nombre", "nota1", "nota2", "nota3", "nota4", "promedio", "estado", "rendimiento"))
            await cursor.execute("UPDATE Estudiantes SET nombre=%s, nota1=%s, nota2=%s, nota3=%s, nota4=%s, promedio=%s, estado=%s, rendimiento=%s WHERE id=%s", values + (student_id,))
        return student
    except HTTPException:
        raise
    except Exception as error:
        raise sql_error(error, "Error interno al actualizar el estudiante.") from error


@router.delete("/{student_id}")
async def delete_student(student_id: int):
    try:
        async with connection() as (_, cursor):
            await cursor.execute("DELETE FROM Estudiantes WHERE id = %s", (student_id,))
            if cursor.rowcount == 0:
                raise HTTPException(404, "Estudiante no encontrado.")
        return {"mensaje": "Estudiante eliminado correctamente.", "id": student_id}
    except HTTPException:
        raise
    except Exception as error:
        raise sql_error(error, "Error interno al eliminar el estudiante.") from error
