from fastapi import APIRouter

from ..common import fetch_all, sql_error
from ..database import connection

router = APIRouter(prefix="/api/areas", tags=["areas"])


@router.get("")
async def list_areas():
    try:
        async with connection() as (_, cursor):
            return await fetch_all(cursor, "SELECT id, codigo, nombre FROM areas ORDER BY nombre")
    except Exception as error:
        raise sql_error(error, "Error interno al consultar las áreas.") from error
