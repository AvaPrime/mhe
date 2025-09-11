
from pydantic import BaseSettings, Field

class Settings(BaseSettings):
    temporal_host: str = Field(default="temporal:7233", validation_alias="TEMPORAL_HOST")
    temporal_namespace: str = Field(default="default", validation_alias="TEMPORAL_NAMESPACE")
    ray_address: str = Field(default="ray-head:10001", validation_alias="RAY_ADDRESS")

settings = Settings()
