from fastapi import APIRouter
from app.routers import auth, profile, company, user

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(profile.router)
api_router.include_router(company.router)
api_router.include_router(user.router)
