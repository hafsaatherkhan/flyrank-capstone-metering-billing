import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import QueuePool, NullPool
from app.config import settings

# Detect serverless environment (Vercel sets AWS_LAMBDA_FUNCTION_NAME or VERCEL env vars)
_IS_SERVERLESS = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))

if _IS_SERVERLESS:
    # Serverless: NullPool — no persistent connections, each request gets a fresh connection.
    # This prevents connection exhaustion on Vercel/Lambda where functions scale horizontally.
    engine = create_engine(
        settings.database_url,
        poolclass=NullPool,
        pool_pre_ping=True,
    )
else:
    # Local / traditional server: QueuePool maintains warm TCP+TLS sessions to avoid
    # 100ms+ handshake latencies. pool_pre_ping prevents dead connection errors on idle drops.
    # pool_recycle ensures stale server connections are refreshed every 5 minutes.
    engine = create_engine(
        settings.database_url,
        poolclass=QueuePool,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_recycle=settings.db_pool_recycle,
        pool_timeout=settings.db_pool_timeout,
        pool_pre_ping=True,
    )

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
