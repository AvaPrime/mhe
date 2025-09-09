
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    db_host: str = Field(default="localhost", alias="MHE_DB_HOST")
    db_port: int = Field(default=5432, alias="MHE_DB_PORT")
    db_name: str = Field(default="mhe", alias="MHE_DB_NAME")
    db_user: str = Field(default="mhe", alias="MHE_DB_USER")
    db_password: str = Field(default="mhe", alias="MHE_DB_PASSWORD")

    # Embeddings
    embed_model: str = Field(default="text-embedding-3-large", alias="MHE_EMBED_MODEL")
    embed_dim: int = Field(default=3072, alias="MHE_EMBED_DIM")
    embedding_provider: str = Field(default="mock", alias="MHE_EMBEDDING_PROVIDER")

    # LLM generation
    llm_provider: str = Field(default="mock", alias="MHE_LLM_PROVIDER")
    llm_model: str = Field(default="gpt-4o-mini", alias="MHE_LLM_MODEL")

    # API keys (optional; used when provider != mock)
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
