from fastapi import APIRouter

from ..organization import DEFAULT_CONFIG, calcular_organizacion
from ..schemas import Payload

router = APIRouter(prefix="/api/organizacion", tags=["organizacion"])


@router.get("/configuracion")
async def organization_config():
    return DEFAULT_CONFIG


@router.post("/planificar")
async def plan_organization(payload: Payload | None = None):
    return calcular_organizacion((payload or Payload()).model_dump(exclude_none=True))
