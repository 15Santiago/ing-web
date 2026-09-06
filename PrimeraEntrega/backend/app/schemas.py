from pydantic import BaseModel, ConfigDict


class Payload(BaseModel):
    model_config = ConfigDict(extra="allow")


class StudentPayload(BaseModel):
    nombre: str | None = None
    nota1: float | None = None
    nota2: float | None = None
    nota3: float | None = None
    nota4: float | None = None
