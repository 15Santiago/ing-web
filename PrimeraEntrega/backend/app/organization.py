DEFAULT_CONFIG = {
    "docentesDisponibles": 30, "maxDocentes": 30, "diasLaboralesSemana": 5,
    "horasTrabajoDiarias": 8, "horasAlmuerzoDiarias": 1,
    "horasTrabajoDocenteSemana": 40, "horasExtraSemanaMax": 1,
    "horasExtraMesMax": 4, "horasJornadaCursoDia": 5,
    "semanasAnioLectivo": 40, "semanasExtraPermitidasMes": 4,
    "cursos": {
        11: {"total": 4, "manana": 4, "tarde": 0, "estudiantes": 30},
        10: {"total": 5, "manana": 5, "tarde": 0, "estudiantes": 30},
        9: {"total": 5, "manana": 2, "tarde": 3, "estudiantes": 28},
        8: {"total": 6, "manana": 3, "tarde": 3, "estudiantes": 28},
        7: {"total": 6, "manana": 3, "tarde": 3, "estudiantes": 28, "inferido": True},
        6: {"total": 6, "manana": 3, "tarde": 3, "estudiantes": 30},
        5: {"total": 9, "manana": 5, "tarde": 4, "estudiantes": 28},
        4: {"total": 9, "manana": 5, "tarde": 4, "estudiantes": 26},
        3: {"total": 9, "manana": 5, "tarde": 4, "estudiantes": 30},
        2: {"total": 10, "manana": 6, "tarde": 4, "estudiantes": 30},
        1: {"total": 10, "manana": 5, "tarde": 5, "estudiantes": 26},
    },
    "materias": [
        {"nombre": "Matemáticas", "horas": 5, "intensidad": "+", "desde": 1},
        {"nombre": "Física", "horas": 5, "intensidad": "+", "desde": 6},
        {"nombre": "Química", "horas": 4, "intensidad": "+", "desde": 6},
        {"nombre": "Biología", "horas": 4, "intensidad": "+", "desde": 1},
        {"nombre": "Inglés", "horas": 2, "intensidad": "-", "desde": 1},
        {"nombre": "Español", "horas": 5, "intensidad": "+", "desde": 1},
        {"nombre": "Educación física", "horas": 2, "intensidad": "-", "desde": 1},
        {"nombre": "Ética", "horas": 2, "intensidad": "-", "desde": 1},
        {"nombre": "Ciencias sociales", "horas": 2, "intensidad": "-", "desde": 1, "hasta": 10},
        {"nombre": "Filosofía", "horas": 2, "intensidad": "-", "desde": 11},
        {"nombre": "Informática", "horas": 2, "intensidad": "-", "desde": 1},
    ],
}


def _positive(value, default):
    try:
        value = float(value)
        return value if value > 0 else default
    except (TypeError, ValueError):
        return default


def _config(input_data):
    return {
        **DEFAULT_CONFIG,
        "docentesDisponibles": min(30, int(_positive(input_data.get("docentesDisponibles"), 30))),
        "horasTrabajoDocenteSemana": _positive(input_data.get("horasTrabajoDocenteSemana"), 40),
        "horasJornadaCursoDia": _positive(input_data.get("horasJornadaCursoDia"), 5),
        "semanasAnioLectivo": int(_positive(input_data.get("semanasAnioLectivo"), 40)),
        "semanasExtraPermitidasMes": int(_positive(input_data.get("semanasExtraPermitidasMes"), 4)),
    }


def calcular_organizacion(input_data=None):
    config = _config(input_data or {})
    cursos = [{"grado": grado, **curso} for grado, curso in config["cursos"].items()]
    total_cursos = sum(c["total"] for c in cursos)
    estudiantes = sum(c["total"] * c["estudiantes"] for c in cursos)
    materias = []
    for materia in config["materias"]:
        cursos_materia = [c for c in cursos if c["grado"] >= materia["desde"] and ("hasta" not in materia or c["grado"] <= materia["hasta"])]
        atendidos = sum(c["total"] for c in cursos_materia)
        horas = atendidos * materia["horas"]
        materias.append({**materia, "cursosAtendidos": atendidos, "horasSemanales": horas,
                         "horasAnuales": horas * config["semanasAnioLectivo"],
                         "docentesRequeridos": -(-horas // config["horasTrabajoDocenteSemana"])})
    horas_totales = sum(m["horasSemanales"] for m in materias)
    capacidad = config["horasTrabajoDocenteSemana"]
    requeridos = -(-horas_totales // capacidad)
    return {
        "configuracion": {k: config[k] for k in ("docentesDisponibles", "maxDocentes", "diasLaboralesSemana", "horasTrabajoDiarias", "horasAlmuerzoDiarias", "horasTrabajoDocenteSemana", "horasExtraSemanaMax", "horasExtraMesMax", "horasJornadaCursoDia", "semanasAnioLectivo", "semanasExtraPermitidasMes")},
        "resumen": {"totalCursos": total_cursos, "estudiantes": estudiantes, "horasSemanalesTotales": horas_totales,
                    "horasAnualesTotales": horas_totales * config["semanasAnioLectivo"], "docentesRequeridos": requeridos,
                    "docentesDisponibles": config["docentesDisponibles"], "docentesFaltantes": max(0, requeridos - config["docentesDisponibles"]),
                    "docentesContratables": 0, "horasExtraSemanales": 0, "horasExtraMensualesMaximas": config["docentesDisponibles"] * 4,
                    "horasPendientes": max(0, horas_totales - config["docentesDisponibles"] * (capacidad + 1)),
                    "capacidadMaximaConExtras": config["docentesDisponibles"] * (capacidad + 1),
                    "turnos": {"manana": {"cursos": sum(c["manana"] for c in cursos), "estudiantes": sum(c["manana"] * c["estudiantes"] for c in cursos)},
                               "tarde": {"cursos": sum(c["tarde"] for c in cursos), "estudiantes": sum(c["tarde"] * c["estudiantes"] for c in cursos)}}},
        "cursos": cursos, "materias": materias, "docentes": [],
        "reglas": ["Los signos + se modelan como materias de mayor intensidad horaria.", "La nómina está limitada a 30 docentes y no se pueden contratar docentes adicionales.", "Cada docente trabaja 8 horas diarias durante 5 días."]
    }
