from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
from datetime import datetime
from typing import Optional, Tuple, List
from app.models.forecast import DemandForecast, ForecastHistory, ForecastPeriodType, RecommendationType
from app.models.product import Product, ProductStatus
from app.models.category import Category
from app.models.sale import Sale, SaleItem, SaleStatus


class CRUDDemandForecast:
    async def get(self, db: AsyncSession, forecast_id: UUID) -> DemandForecast | None:
        result = await db.execute(select(DemandForecast).where(DemandForecast.id == forecast_id))
        return result.scalar_one_or_none()

    async def get_by_product_period(self, db: AsyncSession, company_id: UUID, product_id: UUID, forecast_period: ForecastPeriodType) -> DemandForecast | None:
        result = await db.execute(
            select(DemandForecast)
            .where(DemandForecast.company_id == company_id)
            .where(DemandForecast.product_id == product_id)
            .where(DemandForecast.forecast_period == forecast_period)
            .order_by(DemandForecast.generated_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        db: AsyncSession,
        company_id: UUID,
        skip: int = 0,
        limit: int = 100,
        product_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None,
        forecast_period: Optional[ForecastPeriodType] = None,
        search: Optional[str] = None,
        sort_by: str = "predicted_demand",
        sort_dir: str = "desc",
    ) -> Tuple[List[dict], int]:
        from app.models.forecast import RecommendationType

        query = (
            select(
                DemandForecast.id,
                DemandForecast.product_id,
                DemandForecast.category_id,
                DemandForecast.forecast_period,
                DemandForecast.forecast_start_date,
                DemandForecast.forecast_end_date,
                DemandForecast.predicted_demand,
                DemandForecast.confidence_score,
                DemandForecast.historical_sales,
                DemandForecast.recommendation,
                DemandForecast.generated_at,
                DemandForecast.refreshed_at,
                Product.name.label("product_name"),
                Product.sku.label("product_sku"),
                Product.brand,
                Product.stock_quantity.label("current_stock"),
                Category.name.label("category_name"),
            )
            .join(Product, DemandForecast.product_id == Product.id)
            .outerjoin(Category, DemandForecast.category_id == Category.id)
            .where(DemandForecast.company_id == company_id)
            .where(Product.status == ProductStatus.ACTIVE)
        )

        if product_id:
            query = query.where(DemandForecast.product_id == product_id)
        if category_id:
            query = query.where(DemandForecast.category_id == category_id)
        if forecast_period:
            query = query.where(DemandForecast.forecast_period == forecast_period)
        if search:
            query = query.where(
                Product.name.ilike(f"%{search}%")
                | Product.sku.ilike(f"%{search}%")
                | Category.name.ilike(f"%{search}%")
            )

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        sort_column_map = {
            "predicted_demand": DemandForecast.predicted_demand,
            "confidence_score": DemandForecast.confidence_score,
            "historical_sales": DemandForecast.historical_sales,
            "generated_at": DemandForecast.generated_at,
            "current_stock": Product.stock_quantity,
            "product_name": Product.name,
        }
        sort_column = sort_column_map.get(sort_by, DemandForecast.predicted_demand)
        if sort_dir == "asc":
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())

        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        rows = result.all()

        items = []
        for row in rows:
            items.append({
                "id": row.id,
                "product_id": row.product_id,
                "category_id": row.category_id,
                "forecast_period": row.forecast_period,
                "forecast_start_date": row.forecast_start_date,
                "forecast_end_date": row.forecast_end_date,
                "predicted_demand": row.predicted_demand,
                "confidence_score": float(row.confidence_score),
                "historical_sales": row.historical_sales,
                "recommendation": row.recommendation,
                "generated_at": row.generated_at,
                "refreshed_at": row.refreshed_at,
                "product_name": row.product_name,
                "product_sku": row.product_sku,
                "brand": row.brand,
                "current_stock": row.current_stock,
                "category_name": row.category_name,
            })

        return items, total

    async def list_category_forecasts(
        self,
        db: AsyncSession,
        company_id: UUID,
        skip: int = 0,
        limit: int = 100,
        forecast_period: Optional[ForecastPeriodType] = None,
        sort_by: str = "predicted_demand",
        sort_dir: str = "desc",
    ) -> Tuple[List[dict], int]:
        base_query = (
            select(
                DemandForecast.category_id,
                Category.name.label("category_name"),
                func.coalesce(func.sum(DemandForecast.historical_sales), 0).label("total_historical_sales"),
                func.coalesce(func.sum(DemandForecast.predicted_demand), 0).label("predicted_demand"),
                func.max(DemandForecast.generated_at).label("generated_at"),
                func.max(DemandForecast.forecast_period).label("forecast_period"),
            )
            .join(Category, DemandForecast.category_id == Category.id)
            .where(DemandForecast.company_id == company_id)
            .where(DemandForecast.category_id.isnot(None))
            .group_by(DemandForecast.category_id, Category.name)
        )

        if forecast_period:
            base_query = base_query.where(DemandForecast.forecast_period == forecast_period)

        count_query = select(func.count()).select_from(base_query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        subq = base_query.subquery()
        sort_map = {
            "predicted_demand": subq.c.predicted_demand,
            "historical_sales": subq.c.total_historical_sales,
            "category_name": subq.c.category_name,
            "generated_at": subq.c.generated_at,
        }
        sort_col = sort_map.get(sort_by, subq.c.predicted_demand)
        if sort_dir == "asc":
            final_query = select(subq).order_by(sort_col.asc())
        else:
            final_query = select(subq).order_by(sort_col.desc())

        final_query = final_query.offset(skip).limit(limit)
        result = await db.execute(final_query)
        rows = result.all()

        items = []
        for row in rows:
            growth = 0.0
            if row.total_historical_sales and row.total_historical_sales > 0:
                growth = ((row.predicted_demand or 0) - row.total_historical_sales) / row.total_historical_sales * 100
            items.append({
                "id": f"cat-{row.category_id}-{row.forecast_period}",
                "category_id": row.category_id,
                "category_name": row.category_name,
                "total_historical_sales": row.total_historical_sales or 0,
                "predicted_demand": row.predicted_demand or 0,
                "expected_growth_percentage": round(growth, 2),
                "forecast_period": row.forecast_period,
                "generated_at": row.generated_at,
            })

        return items, total

    async def get_kpis(self, db: AsyncSession, company_id: UUID, forecast_period: Optional[ForecastPeriodType] = None) -> dict:
        base_query = select(DemandForecast).where(DemandForecast.company_id == company_id)
        if forecast_period:
            base_query = base_query.where(DemandForecast.forecast_period == forecast_period)
        result = await db.execute(base_query)
        forecasts = result.scalars().all()

        total_predicted_demand = sum(f.predicted_demand for f in forecasts)
        products_expected_to_run_out = sum(1 for f in forecasts if f.recommendation in (RecommendationType.REORDER_SOON, RecommendationType.IMMEDIATE_RESTOCK_REQUIRED))
        high_growth_products = 0
        slow_moving_products = 0

        accuracies = []
        for f in forecasts:
            history_result = await db.execute(
                select(ForecastHistory).where(ForecastHistory.forecast_id == f.id).order_by(ForecastHistory.created_at.desc()).limit(1)
            )
            last_history = history_result.scalar_one_or_none()
            if last_history and last_history.accuracy is not None:
                accuracies.append(float(last_history.accuracy))

        forecast_accuracy = round(sum(accuracies) / len(accuracies), 2) if accuracies else 0.0

        return {
            "total_predicted_demand": total_predicted_demand,
            "products_expected_to_run_out": products_expected_to_run_out,
            "high_growth_products": high_growth_products,
            "slow_moving_products": slow_moving_products,
            "forecast_accuracy": forecast_accuracy,
        }

    async def create(self, db: AsyncSession, company_id: UUID, **kwargs) -> DemandForecast:
        forecast = DemandForecast(company_id=company_id, **kwargs)
        db.add(forecast)
        await db.commit()
        await db.refresh(forecast)
        return forecast

    async def update(self, db: AsyncSession, forecast: DemandForecast, **kwargs) -> DemandForecast:
        for key, value in kwargs.items():
            setattr(forecast, key, value)
        forecast.refreshed_at = datetime.utcnow()
        await db.commit()
        await db.refresh(forecast)
        return forecast

    async def delete(self, db: AsyncSession, forecast: DemandForecast) -> None:
        await db.delete(forecast)
        await db.commit()

    async def create_history(self, db: AsyncSession, forecast_id: UUID, historical_sales: int, prediction: int, accuracy: Optional[float] = None) -> ForecastHistory:
        history = ForecastHistory(
            forecast_id=forecast_id,
            historical_sales=historical_sales,
            prediction=prediction,
            accuracy=accuracy,
        )
        db.add(history)
        await db.commit()
        await db.refresh(history)
        return history

    async def get_history(self, db: AsyncSession, forecast_id: UUID) -> List[ForecastHistory]:
        result = await db.execute(
            select(ForecastHistory).where(ForecastHistory.forecast_id == forecast_id).order_by(ForecastHistory.created_at.desc())
        )
        return list(result.scalars().all())

    async def delete_by_period(self, db: AsyncSession, company_id: UUID, forecast_period: ForecastPeriodType) -> None:
        forecasts = await db.execute(
            select(DemandForecast).where(DemandForecast.company_id == company_id).where(DemandForecast.forecast_period == forecast_period)
        )
        for f in forecasts.scalars().all():
            await db.delete(f)
        await db.commit()

    async def count_by_period(self, db: AsyncSession, company_id: UUID, forecast_period: ForecastPeriodType) -> int:
        result = await db.execute(
            select(func.count(DemandForecast.id))
            .where(DemandForecast.company_id == company_id)
            .where(DemandForecast.forecast_period == forecast_period)
        )
        return result.scalar() or 0


demand_forecast = CRUDDemandForecast()
