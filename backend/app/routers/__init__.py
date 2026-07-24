from fastapi import APIRouter
from app.routers import auth, profile, company, user, dashboard, category, product, sale, notifications, inventory

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(profile.router)
api_router.include_router(company.router)
api_router.include_router(user.router)
api_router.include_router(dashboard.router)
api_router.include_router(category.router)
api_router.include_router(product.router)
api_router.include_router(inventory.router)
api_router.include_router(sale.router)
api_router.include_router(notifications.router)
