from fastapi import HTTPException

from .schemas import StudentPayload


async def fetch_one(cursor, query, args=()):
    await cursor.execute(query, args)
    return await cursor.fetchone()


async def fetch_all(cursor, query, args=()):
    await cursor.execute(query, args)
    return await cursor.fetchall()


def sql_error(error, default="Error interno al procesar la solicitud."):
    message = str(error).lower()
    if "duplicate" in message or "1062" in message:
        return HTTPException(409, "El registro ya existe.")
    return HTTPException(500, default)


def student_result(data: StudentPayload, student_id=None):
    errors = []
    if not data.nombre or not data.nombre.strip():
        errors.append("El nombre del estudiante es obligatorio.")
    grades = {f"nota{i}": getattr(data, f"nota{i}") for i in range(1, 5)}
    for name, value in grades.items():
        if value is None:
            errors.append(f"El campo {name} es obligatorio y debe ser numérico.")
        elif not 0 <= value <= 5:
            errors.append(f"El campo {name} debe estar entre 0.0 y 5.0 (valor recibido: {value}).")
    if errors:
        raise HTTPException(400, {"mensaje": "Datos inválidos.", "errores": errors})
    average = round(sum(grades.values()) / 4, 1)
    if average <= 2.9:
        performance = "Rendimiento insuficiente"
    elif average <= 3.9:
        performance = "Aprobado"
    elif average <= 4.5:
        performance = "Aprobado con sobresaliente"
    else:
        performance = "Aprobado con excelente"
    return {"id": student_id, "nombre": data.nombre.strip(), **grades, "promedio": average,
            "estado": "Aprobado" if average >= 3 else "No aprobado", "rendimiento": performance}
