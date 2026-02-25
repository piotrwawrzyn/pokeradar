from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGODB_URI: str
    MONGODB_DB: str = "pokeradar"
    ML_THRESHOLD: float = 70.0
    PORT: int = 8000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
