from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    database_url_test: str
    polar_access_token: str = "polar_oat_placeholder"
    polar_webhook_secret: str = "polar_webhook_placeholder"
    polar_pro_product_id: str = "polar_product_placeholder"
    polar_server: str = "sandbox"
    app_base_url: str = "http://localhost:8000"
    web_origin: str = "http://localhost:3000"
    cron_secret: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    # Database Connection Pool Settings (tuned for PgBouncer / Neon pooler)
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_recycle: int = 300
    db_pool_timeout: int = 30

    # Background Reconciliation & Retry Settings
    reconcile_max_retries: int = 3
    reconcile_backoff_base: float = 0.5
    reconcile_backoff_max: float = 5.0
    reconcile_request_timeout: float = 5.0
    alert_webhook_url: str | None = None

    # SMTP Configuration for Anti-Spam Verified Emails & OTP
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "HisaabLedger"

    # Google OAuth
    google_client_id: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
