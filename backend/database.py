# backend/database.py
import os
import ssl
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in .env")

# Create a custom SSL context that accepts Aiven's connection without crashing
custom_ssl_context = ssl.create_default_context()
custom_ssl_context.check_hostname = False
custom_ssl_context.verify_mode = ssl.CERT_NONE

# Create the async engine using our relaxed SSL context
engine = create_async_engine(
    DATABASE_URL,
    connect_args={"ssl": custom_ssl_context} if "mysql" in DATABASE_URL else {}
)

# Create a factory for async sessions
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# This Base class is what our database models will inherit from
Base = declarative_base()

# Dependency function to get the database session in our FastAPI endpoints
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session