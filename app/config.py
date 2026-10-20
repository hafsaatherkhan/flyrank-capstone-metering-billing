from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    database_url_test: str
    stripe_secret_key: str
    stripe_webhook_secret: str
    stripe_pro_price_id: str
    app_base_url: str = "http://localhost:8000"
    cron_secret: str

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
