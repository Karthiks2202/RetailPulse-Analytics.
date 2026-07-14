from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://retailpulse:retailpulse@localhost:5432/retailpulse"
    JWT_ACCESS_SECRET: str = "super_secret_retail_pulse_access_key_987654321_abcd"
    JWT_REFRESH_SECRET: str = "super_secret_retail_pulse_refresh_key_123456789_efgh"
    JWT_ACCESS_EXPIRY_MINUTES: int = 15
    JWT_REFRESH_EXPIRY_DAYS: int = 7
    APP_NAME: str = "RetailPulse Analytics API"
    APP_ENV: str = "development"

settings = Settings()
