import random
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from .common import fetch_all, fetch_one, sql_error, student_result
from .database import close_pool, connection
from .routers.organization import router as organization_router
from .routers.students import router as students_router
from .routers.areas import router as areas_router
from .schemas import Payload


@asynccontextmanager
async def lifespan(_app):
    yield
    await close_pool()


app = FastAPI(title="API Gestión de Notas Académicas", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(students_router)
app.include_router(organization_router)
app.include_router(areas_router)


@app.get("/api/health")
async def health():
    return {"ok": True, "mensaje": "API de gestión de notas funcionando correctamente."}


@app.get("/api/materias")
async def list_subjects():
    try:
        async with connection() as (_, cursor):
            subjects = await fetch_all(cursor, "SELECT m.id, m.nombre, m.area_id, a.codigo area_codigo, a.nombre area_nombre FROM materias m LEFT JOIN areas a ON a.id=m.area_id ORDER BY m.nombre")
            plans = await fetch_all(cursor, "SELECT id, nivel, grado_min, grado_max, materia_id, bloques_semana, horas_semana FROM plan_materias")
        return [{**subject, "intensidadPorNivel": [plan for plan in plans if plan["materia_id"] == subject["id"]]} for subject in subjects]
    except Exception as error:
        raise sql_error(error, "Error interno al consultar las materias.") from error


@app.post("/api/materias", status_code=201)
async def create_subject(payload: Payload):
    name = (payload.nombre or "").strip()
    if not name:
        raise HTTPException(400, "El nombre de la materia es obligatorio.")
    try:
        async with connection() as (_, cursor):
            await cursor.execute("INSERT INTO materias (nombre, area_id) VALUES (%s,%s)", (name, payload.areaId or None))
            return {"id": cursor.lastrowid, "nombre": name, "areaId": payload.areaId or None}
    except Exception as error:
        raise sql_error(error, "Error interno al crear la materia.") from error


@app.put("/api/materias/{subject_id}")
async def update_subject(subject_id: int, payload: Payload):
    try:
        async with connection() as (_, cursor):
            await cursor.execute("UPDATE materias SET nombre=%s, area_id=%s WHERE id=%s", (payload.nombre, payload.areaId or None, subject_id))
            if cursor.rowcount == 0:
                raise HTTPException(404, "Materia no encontrada.")
        return {"id": subject_id, "nombre": payload.nombre, "areaId": payload.areaId or None}
    except HTTPException:
        raise
    except Exception as error:
        raise sql_error(error, "Error interno al actualizar la materia.") from error


@app.delete("/api/materias/{subject_id}")
async def delete_subject(subject_id: int):
    try:
        async with connection() as (_, cursor):
            row = await fetch_one(cursor, "SELECT COUNT(*) total FROM horarios WHERE materia_id=%s", (subject_id,))
            if row["total"]:
                raise HTTPException(409, f"No se puede eliminar: la materia tiene {row['total']} bloques de horario asignados.")
            await cursor.execute("DELETE FROM materias WHERE id=%s", (subject_id,))
            if cursor.rowcount == 0:
                raise HTTPException(404, "Materia no encontrada.")
        return {"mensaje": "Materia eliminada correctamente.", "id": subject_id}
    except HTTPException:
        raise
    except Exception as error:
        raise sql_error(error, "Error interno al eliminar la materia.") from error


@app.post("/api/materias/plan", status_code=201)
async def create_plan(payload: Payload):
    required = ("nivel", "materiaId", "bloquesSemana", "horasSemana")
    if any(not getattr(payload, key, None) for key in required):
        raise HTTPException(400, "nivel, materiaId, bloquesSemana y horasSemana son obligatorios.")
    try:
        async with connection() as (_, cursor):
            await cursor.execute("INSERT INTO plan_materias (nivel, grado_min, grado_max, materia_id, bloques_semana, horas_semana) VALUES (%s,%s,%s,%s,%s,%s)", (payload.nivel, payload.gradoMin or 1, payload.gradoMax or 11, payload.materiaId, payload.bloquesSemana, payload.horasSemana))
            return {"id": cursor.lastrowid, **payload.model_dump()}
    except Exception as error:
        raise sql_error(error, "Error interno al crear el plan de materia.") from error


@app.put("/api/materias/plan/{plan_id}")
async def update_plan(plan_id: int, payload: Payload):
    try:
        async with connection() as (_, cursor):
            await cursor.execute("UPDATE plan_materias SET nivel=%s, grado_min=%s, grado_max=%s, bloques_semana=%s, horas_semana=%s WHERE id=%s", (payload.nivel, payload.gradoMin, payload.gradoMax, payload.bloquesSemana, payload.horasSemana, plan_id))
            if cursor.rowcount == 0:
                raise HTTPException(404, "Plan de materia no encontrado.")
        return {"id": plan_id, **payload.model_dump()}
    except HTTPException:
        raise
    except Exception as error:
        raise sql_error(error, "Error interno al actualizar el plan de materia.") from error


@app.delete("/api/materias/plan/{plan_id}")
async def delete_plan(plan_id: int):
    async with connection() as (_, cursor):
        await cursor.execute("DELETE FROM plan_materias WHERE id=%s", (plan_id,))
        if cursor.rowcount == 0:
            raise HTTPException(404, "Plan de materia no encontrado.")
    return {"mensaje": "Plan de materia eliminado correctamente.", "id": plan_id}


def random_students(capacity):
    minimum = max(1, round(capacity * 0.75))
    return random.randint(minimum, capacity)


@app.get("/api/cursos")
async def list_courses(jornada: str | None = None, grado: int | None = None):
    filters, args = [], []
    if jornada: filters.append("jornada=%s"); args.append(jornada)
    if grado is not None: filters.append("grado=%s"); args.append(grado)
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    async with connection() as (_, cursor):
        return await fetch_all(cursor, f"SELECT id, grado, seccion, jornada, cupo_maximo, estudiantes FROM cursos {where} ORDER BY grado,seccion", args)


@app.get("/api/cursos/{course_id}")
async def get_course(course_id: int):
    async with connection() as (_, cursor):
        course = await fetch_one(cursor, "SELECT * FROM cursos WHERE id=%s", (course_id,))
        if not course: raise HTTPException(404, "Curso no encontrado.")
        schedule = await fetch_all(cursor, "SELECT h.id,h.dia,h.hora_inicio,h.hora_fin,m.nombre materia,h.docente_id,d.nombre docente_nombre FROM horarios h JOIN materias m ON m.id=h.materia_id LEFT JOIN docentes d ON d.id=h.docente_id WHERE h.curso_id=%s ORDER BY h.dia,h.hora_inicio", (course_id,))
    return {**course, "horario": schedule}


@app.post("/api/cursos", status_code=201)
async def create_course(payload: Payload):
    if not all(getattr(payload, key, None) for key in ("grado", "seccion", "jornada", "cupoMaximo")):
        raise HTTPException(400, "grado, seccion, jornada y cupoMaximo son obligatorios.")
    students = payload.estudiantes if payload.estudiantes is not None else random_students(payload.cupoMaximo)
    async with connection() as (_, cursor):
        await cursor.execute("INSERT INTO cursos (grado,seccion,jornada,cupo_maximo,estudiantes) VALUES (%s,%s,%s,%s,%s)", (payload.grado, payload.seccion, payload.jornada, payload.cupoMaximo, students))
        return await fetch_one(cursor, "SELECT * FROM cursos WHERE id=%s", (cursor.lastrowid,))


@app.put("/api/cursos/{course_id}")
async def update_course(course_id: int, payload: Payload):
    async with connection() as (_, cursor):
        await cursor.execute("UPDATE cursos SET grado=%s,seccion=%s,jornada=%s,cupo_maximo=%s,estudiantes=%s WHERE id=%s", (payload.grado, payload.seccion, payload.jornada, payload.cupoMaximo, payload.estudiantes, course_id))
        if cursor.rowcount == 0: raise HTTPException(404, "Curso no encontrado.")
        return await fetch_one(cursor, "SELECT * FROM cursos WHERE id=%s", (course_id,))


@app.delete("/api/cursos/{course_id}")
async def delete_course(course_id: int):
    async with connection() as (_, cursor):
        await cursor.execute("DELETE FROM cursos WHERE id=%s", (course_id,))
        if cursor.rowcount == 0: raise HTTPException(404, "Curso no encontrado.")
    return {"mensaje": "Curso eliminado correctamente.", "id": course_id}


@app.post("/api/cursos/aleatorizar-cupos")
async def randomize_courses(payload: Payload | None = None):
    course_id = getattr(payload, "cursoId", None) if payload else None
    async with connection() as (_, cursor):
        courses = await fetch_all(cursor, "SELECT id,cupo_maximo FROM cursos WHERE id=%s" if course_id else "SELECT id,cupo_maximo FROM cursos", (course_id,) if course_id else ())
        if course_id and not courses: raise HTTPException(404, "Curso no encontrado.")
        for course in courses:
            await cursor.execute("UPDATE cursos SET estudiantes=%s WHERE id=%s", (random_students(course["cupo_maximo"]), course["id"]))
        return await fetch_all(cursor, "SELECT * FROM cursos ORDER BY grado,seccion")


def block_minutes(block):
    start = sum(int(part) * factor for part, factor in zip(str(block["hora_inicio"]).split(":")[:2], (60, 1)))
    end = sum(int(part) * factor for part, factor in zip(str(block["hora_fin"]).split(":")[:2], (60, 1)))
    return end - start


@app.get("/api/docentes")
async def list_teachers(activo: str | None = None, areaId: int | None = None):
    filters, args = [], []
    if activo is not None: filters.append("d.activo=%s"); args.append(1 if activo == "true" else 0)
    if areaId is not None: filters.append("d.area_id=%s"); args.append(areaId)
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    query = f"""SELECT d.id,d.nombre,d.area_id,a.codigo area_codigo,a.nombre area_nombre,
        d.horas_contratadas,d.activo,d.fecha_baja,
        COALESCE(SUM(TIMESTAMPDIFF(MINUTE,h.hora_inicio,h.hora_fin))/60,0) horas_asignadas,
        COUNT(h.id) bloques_asignados FROM docentes d LEFT JOIN areas a ON a.id=d.area_id
        LEFT JOIN horarios h ON h.docente_id=d.id {where}
        GROUP BY d.id,d.nombre,d.area_id,a.codigo,a.nombre,d.horas_contratadas,d.activo,d.fecha_baja
        ORDER BY d.activo DESC,d.nombre"""
    async with connection() as (_, cursor):
        return await fetch_all(cursor, query, args)


@app.get("/api/docentes/{teacher_id}")
async def get_teacher(teacher_id: str):
    async with connection() as (_, cursor):
        teacher = await fetch_one(cursor, "SELECT d.id,d.nombre,d.area_id,a.codigo area_codigo,a.nombre area_nombre,d.horas_contratadas,d.activo,d.fecha_baja FROM docentes d LEFT JOIN areas a ON a.id=d.area_id WHERE d.id=%s", (teacher_id,))
        if not teacher: raise HTTPException(404, "Docente no encontrado.")
        schedule = await fetch_all(cursor, "SELECT h.id,h.dia,h.hora_inicio,h.hora_fin,m.nombre materia,c.id curso_id,c.grado,c.seccion,c.jornada,c.estudiantes FROM horarios h JOIN materias m ON m.id=h.materia_id JOIN cursos c ON c.id=h.curso_id WHERE h.docente_id=%s ORDER BY h.dia,h.hora_inicio", (teacher_id,))
    return {**teacher, "horasAsignadas": sum(block_minutes(block) for block in schedule) / 60, "horario": schedule}


@app.post("/api/docentes", status_code=201)
async def create_teacher(payload: Payload):
    name = (payload.nombre or "").strip()
    if not name: raise HTTPException(400, "El nombre del docente es obligatorio.")
    async with connection() as (_, cursor):
        teacher_id = payload.id
        if not teacher_id:
            prefix = "DOC"
            if payload.areaId:
                area = await fetch_one(cursor, "SELECT codigo FROM areas WHERE id=%s", (payload.areaId,))
                if area: prefix = area["codigo"]
            existing = await fetch_all(cursor, "SELECT id FROM docentes WHERE id LIKE %s", (f"{prefix}-%",))
            numbers = [int(row["id"].split("-")[-1]) for row in existing if row["id"].split("-")[-1].isdigit()]
            teacher_id = f"{prefix}-{max(numbers, default=0) + 1:02d}"
        await cursor.execute("INSERT INTO docentes (id,nombre,area_id,horas_contratadas,activo) VALUES (%s,%s,%s,%s,TRUE)", (teacher_id, name, payload.areaId or None, payload.horasContratadas or 34.5))
        return {**(await fetch_one(cursor, "SELECT d.*,a.codigo area_codigo,a.nombre area_nombre FROM docentes d LEFT JOIN areas a ON a.id=d.area_id WHERE d.id=%s", (teacher_id,))), "horasAsignadas": 0}


@app.put("/api/docentes/{teacher_id}")
async def update_teacher(teacher_id: str, payload: Payload):
    async with connection() as (_, cursor):
        await cursor.execute("UPDATE docentes SET nombre=%s,area_id=%s,horas_contratadas=%s WHERE id=%s", (payload.nombre, payload.areaId or None, payload.horasContratadas, teacher_id))
        if cursor.rowcount == 0: raise HTTPException(404, "Docente no encontrado.")
        return await fetch_one(cursor, "SELECT * FROM docentes WHERE id=%s", (teacher_id,))


async def dismiss_teachers(ids):
    async with connection() as (conn, cursor):
        placeholders = ",".join(["%s"] * len(ids))
        teachers = await fetch_all(cursor, f"SELECT id,nombre FROM docentes WHERE id IN ({placeholders}) AND activo=TRUE", ids)
        if not teachers: raise HTTPException(404, "Ninguno de los docentes indicados existe o ya estaba inactivo.")
        valid_ids = [teacher["id"] for teacher in teachers]
        valid_placeholders = ",".join(["%s"] * len(valid_ids))
        blocks = await fetch_all(cursor, f"""SELECT h.id horario_id,h.docente_id,h.dia,h.hora_inicio,h.hora_fin,c.id curso_id,c.grado,c.seccion,c.jornada,c.estudiantes,m.nombre materia
            FROM horarios h JOIN cursos c ON c.id=h.curso_id JOIN materias m ON m.id=h.materia_id
            WHERE h.docente_id IN ({valid_placeholders}) ORDER BY c.grado,c.seccion,h.dia,h.hora_inicio""", valid_ids)
        await cursor.execute(f"UPDATE docentes SET activo=FALSE,fecha_baja=NOW() WHERE id IN ({valid_placeholders})", valid_ids)
        await cursor.execute(f"UPDATE horarios SET docente_id=NULL WHERE docente_id IN ({valid_placeholders})", valid_ids)
        await conn.commit()
    affected = {}
    for block in blocks:
        item = affected.setdefault(block["curso_id"], {"cursoId": block["curso_id"], "curso": f"{block['grado']}°{block['seccion']}", "jornada": block["jornada"], "estudiantes": block["estudiantes"], "bloquesVacantes": []})
        item["bloquesVacantes"].append({"horarioId": block["horario_id"], "docenteAnterior": block["docente_id"], "dia": block["dia"], "horaInicio": block["hora_inicio"], "horaFin": block["hora_fin"], "materia": block["materia"]})
    return {"docentesDespedidos": teachers, "totalBloquesAfectados": len(blocks), "cursosAfectados": list(affected.values())}


@app.post("/api/docentes/despedir")
async def dismiss(payload: Payload):
    ids = payload.ids
    if not isinstance(ids, list) or not ids: raise HTTPException(400, 'Debes indicar al menos un id de docente en "ids".')
    return await dismiss_teachers(ids)


@app.delete("/api/docentes/{teacher_id}")
async def delete_teacher(teacher_id: str):
    return await dismiss_teachers([teacher_id])


async def assign_blocks(teacher_id, block_ids):
    async with connection() as (_, cursor):
        teacher = await fetch_one(cursor, "SELECT * FROM docentes WHERE id=%s", (teacher_id,))
        if not teacher: raise HTTPException(404, "Docente no encontrado.")
        if not teacher["activo"]: raise HTTPException(422, "No se puede asignar horario a un docente inactivo.")
        current = await fetch_all(cursor, "SELECT dia,hora_inicio,hora_fin FROM horarios WHERE docente_id=%s", (teacher_id,))
        occupied = {f"{row['dia']}-{row['hora_inicio']}" for row in current}
        hours = sum(block_minutes(row) for row in current) / 60
        results = []
        for block_id in block_ids:
            block = await fetch_one(cursor, "SELECT * FROM horarios WHERE id=%s", (block_id,))
            if not block: results.append({"horarioId": block_id, "asignado": False, "motivo": "El bloque de horario no existe."}); continue
            key = f"{block['dia']}-{block['hora_inicio']}"; duration = block_minutes(block) / 60
            if key in occupied: results.append({"horarioId": block_id, "asignado": False, "motivo": "El docente ya tiene otra clase ese día y hora."}); continue
            if hours + duration > float(teacher["horas_contratadas"]): results.append({"horarioId": block_id, "asignado": False, "motivo": "Se superaría el máximo de horas contratadas del docente."}); continue
            await cursor.execute("UPDATE horarios SET docente_id=%s WHERE id=%s", (teacher_id, block_id)); occupied.add(key); hours += duration
            results.append({"horarioId": block_id, "asignado": True})
    return {"docenteId": teacher_id, "horasAsignadasTotales": hours, "resultados": results}


@app.post("/api/docentes/{teacher_id}/asignar-vacantes")
async def assign_teacher_blocks(teacher_id: str, payload: Payload):
    block_ids = payload.horarioIds
    if not isinstance(block_ids, list) or not block_ids: raise HTTPException(400, 'Debes indicar al menos un id de horario en "horarioIds".')
    return await assign_blocks(teacher_id, block_ids)


def schedule_filters(params):
    filters, args = [], []
    for key, column in (("cursoId", "h.curso_id"), ("docenteId", "h.docente_id"), ("materiaId", "h.materia_id"), ("dia", "h.dia")):
        if params.get(key): filters.append(f"{column}=%s"); args.append(params[key])
    if params.get("jornada"): filters.append("c.jornada=%s"); args.append(params["jornada"])
    if params.get("vacantes") == "true": filters.append("h.docente_id IS NULL")
    return (f"WHERE {' AND '.join(filters)}" if filters else ""), args


@app.get("/api/horarios")
async def list_schedule(cursoId=None, docenteId=None, materiaId=None, jornada=None, dia=None, vacantes=None):
    where, args = schedule_filters(locals())
    query = f"SELECT h.id,h.dia,h.hora_inicio,h.hora_fin,h.docente_id,d.nombre docente_nombre,h.materia_id,m.nombre materia,h.curso_id,c.grado,c.seccion,c.jornada,c.estudiantes FROM horarios h JOIN cursos c ON c.id=h.curso_id JOIN materias m ON m.id=h.materia_id LEFT JOIN docentes d ON d.id=h.docente_id {where} ORDER BY c.grado,c.seccion,h.dia,h.hora_inicio"
    async with connection() as (_, cursor): return await fetch_all(cursor, query, args)


@app.get("/api/horarios/conflictos")
async def schedule_conflicts():
    async with connection() as (_, cursor):
        teacher = await fetch_all(cursor, "SELECT docente_id,dia,hora_inicio,COUNT(*) choques,GROUP_CONCAT(id) horario_ids FROM horarios WHERE docente_id IS NOT NULL GROUP BY docente_id,dia,hora_inicio HAVING COUNT(*)>1")
        course = await fetch_all(cursor, "SELECT curso_id,dia,hora_inicio,COUNT(*) choques,GROUP_CONCAT(id) horario_ids FROM horarios GROUP BY curso_id,dia,hora_inicio HAVING COUNT(*)>1")
    return {"conflictosDocente": teacher, "conflictosCurso": course, "total": len(teacher) + len(course)}


@app.post("/api/horarios", status_code=201)
async def create_schedule(payload: Payload):
    required = ("cursoId", "materiaId", "dia", "horaInicio", "horaFin")
    if any(not getattr(payload, key, None) for key in required): raise HTTPException(400, "cursoId, materiaId, dia, horaInicio y horaFin son obligatorios.")
    async with connection() as (_, cursor):
        await cursor.execute("INSERT INTO horarios (curso_id,materia_id,docente_id,dia,hora_inicio,hora_fin) VALUES (%s,%s,%s,%s,%s,%s)", (payload.cursoId, payload.materiaId, payload.docenteId or None, payload.dia, payload.horaInicio, payload.horaFin))
        return {"id": cursor.lastrowid, **payload.model_dump()}


@app.put("/api/horarios/{schedule_id}")
async def update_schedule(schedule_id: int, payload: Payload):
    async with connection() as (_, cursor):
        await cursor.execute("UPDATE horarios SET curso_id=%s,materia_id=%s,docente_id=%s,dia=%s,hora_inicio=%s,hora_fin=%s WHERE id=%s", (payload.cursoId, payload.materiaId, payload.docenteId or None, payload.dia, payload.horaInicio, payload.horaFin, schedule_id))
        if cursor.rowcount == 0: raise HTTPException(404, "Bloque de horario no encontrado.")
    return {"id": schedule_id, **payload.model_dump()}


@app.put("/api/horarios/{schedule_id}/asignar")
async def assign_schedule(schedule_id: int, payload: Payload):
    async with connection() as (_, cursor):
        block = await fetch_one(cursor, "SELECT * FROM horarios WHERE id=%s", (schedule_id,))
        if not block: raise HTTPException(404, "Bloque de horario no encontrado.")
        teacher_id = payload.docenteId
        if not teacher_id:
            await cursor.execute("UPDATE horarios SET docente_id=NULL WHERE id=%s", (schedule_id,)); return {"id": schedule_id, "docenteId": None, "mensaje": "Bloque dejado vacante."}
        teacher = await fetch_one(cursor, "SELECT * FROM docentes WHERE id=%s", (teacher_id,))
        if not teacher: raise HTTPException(404, "Docente no encontrado.")
        if not teacher["activo"]: raise HTTPException(422, "No se puede asignar horario a un docente inactivo.")
        occupied = await fetch_all(cursor, "SELECT * FROM horarios WHERE docente_id=%s AND id!=%s", (teacher_id, schedule_id))
        if any(row["dia"] == block["dia"] and row["hora_inicio"] == block["hora_inicio"] for row in occupied): raise HTTPException(409, "El docente ya tiene otra clase asignada ese día y hora.")
        if sum(block_minutes(row) for row in occupied) / 60 + block_minutes(block) / 60 > float(teacher["horas_contratadas"]): raise HTTPException(422, "Se superaría el máximo de horas contratadas del docente.")
        await cursor.execute("UPDATE horarios SET docente_id=%s WHERE id=%s", (teacher_id, schedule_id))
    return {"id": schedule_id, "docenteId": teacher_id, "advertencia": None}


@app.delete("/api/horarios/{schedule_id}")
async def delete_schedule(schedule_id: int):
    async with connection() as (_, cursor):
        await cursor.execute("DELETE FROM horarios WHERE id=%s", (schedule_id,))
        if cursor.rowcount == 0: raise HTTPException(404, "Bloque de horario no encontrado.")
    return {"mensaje": "Bloque de horario eliminado correctamente.", "id": schedule_id}


@app.get("/api/dashboard")
async def dashboard():
    async with connection() as (_, cursor):
        courses = await fetch_one(cursor, "SELECT COUNT(*) totalCursos,COALESCE(SUM(estudiantes),0) totalEstudiantes,COALESCE(SUM(cupo_maximo),0) capacidadTotal FROM cursos")
        teachers = await fetch_one(cursor, "SELECT SUM(activo=TRUE) activos,SUM(activo=FALSE) inactivos FROM docentes")
        hours = await fetch_one(cursor, "SELECT COALESCE(SUM(TIMESTAMPDIFF(MINUTE,hora_inicio,hora_fin))/60,0) horasSemanalesTotales,COUNT(*) totalBloques,SUM(docente_id IS NULL) bloquesVacantes FROM horarios")
        by_shift = await fetch_all(cursor, "SELECT jornada,COUNT(*) cursos,COALESCE(SUM(estudiantes),0) estudiantes FROM cursos GROUP BY jornada")
        by_area = await fetch_all(cursor, "SELECT a.codigo,a.nombre,COUNT(d.id) docentes,COALESCE(SUM(d.activo=TRUE),0) activos FROM areas a LEFT JOIN docentes d ON d.area_id=a.id GROUP BY a.id,a.codigo,a.nombre ORDER BY a.nombre")
        conflicts = await fetch_one(cursor, "SELECT (SELECT COUNT(*) FROM (SELECT docente_id FROM horarios WHERE docente_id IS NOT NULL GROUP BY docente_id,dia,hora_inicio HAVING COUNT(*)>1) t) + (SELECT COUNT(*) FROM (SELECT curso_id FROM horarios GROUP BY curso_id,dia,hora_inicio HAVING COUNT(*)>1) u) total")
    return {"totalCursos": courses["totalCursos"], "totalEstudiantes": courses["totalEstudiantes"], "capacidadTotal": courses["capacidadTotal"], "docentesActivos": int(teachers["activos"] or 0), "docentesInactivos": int(teachers["inactivos"] or 0), "horasSemanalesTotales": float(hours["horasSemanalesTotales"] or 0), "totalBloques": hours["totalBloques"], "bloquesVacantes": int(hours["bloquesVacantes"] or 0), "porJornada": by_shift, "porArea": by_area, "conflictos": conflicts["total"]}


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {"mensaje": exc.detail}
    return JSONResponse(status_code=exc.status_code, content=detail)


app.mount("/", StaticFiles(directory=Path(__file__).resolve().parents[1] / "public", html=True), name="public")
