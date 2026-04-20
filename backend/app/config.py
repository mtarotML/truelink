from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://truelink:truelink@db:5432/truelink"

    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 30

    GOOGLE_CLIENT_ID: str = ""

    MEDIA_ROOT: str = "/media"
    PUBLIC_MEDIA_BASE: str = "/media"

    CORS_ORIGINS: str = "http://localhost,http://localhost:3000"

    ADMIN_EMAIL: str = "martintarot53@gmail.com"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
