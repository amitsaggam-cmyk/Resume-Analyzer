# backend/test_main.py
import pytest
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.mark.asyncio
async def test_health_check():
    """
    Test that the root endpoint returns a 200 OK and the correct welcome message.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/")
    
    assert response.status_code == 200
    assert response.json() == {
        "status": "success", 
        "message": "Welcome to the Resume Analyzer API! Database and server are running."
    }