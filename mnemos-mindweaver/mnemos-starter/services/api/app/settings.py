
from pydantic import BaseSettings, Field

class Settings(BaseSettings):
    api_host: str = Field(default="0.0.0.0", validation_alias="API_HOST")
    api_port: int = Field(default=8000, validation_alias="API_PORT")
    database_url: str = Field(default="postgresql+psycopg://mnemos:mnemos@postgres:5432/mnemos", validation_alias="DATABASE_URL")
    temporal_host: str = Field(default="temporal:7233", validation_alias="TEMPORAL_HOST")
    temporal_namespace: str = Field(default="default", validation_alias="TEMPORAL_NAMESPACE")
    nats_url: str = Field(default="nats://nats:4222", validation_alias="NATS_URL")

settings = Settings()  # reads env at import time
