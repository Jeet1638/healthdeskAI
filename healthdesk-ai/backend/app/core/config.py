from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = Field(
        default="postgresql://healthdesk:healthdesk@localhost:5432/healthdesk"
    )
    JWT_SECRET_KEY: str = Field(default="development_secret_change_me_min_32_chars")
    OPENAI_API_KEY: str = Field(default="")
    GROQ_API_KEY: str = Field(default="")
    LLM_PROVIDER: str = Field(default="openai")
    LLM_MODEL: str = Field(default="")
    GOOGLE_CLIENT_ID: str = Field(default="")
    RESEND_API_KEY: str = Field(default="")
    RESEND_FROM_EMAIL: str = Field(default="onboarding@resend.dev")
    FRONTEND_URL: str = Field(default="http://localhost:3000")
    ENVIRONMENT: str = Field(default="development")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def validate_jwt_secret_key(cls, value: str) -> str:
        if len(value) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters long")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
