from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta
from typing import Optional, Tuple, List
from uuid import UUID
from decimal import Decimal
from app.models.forecast import DemandForecast, ForecastHistory, ForecastPeriodType, RecommendationType
from app.models.product import Product, ProductStatus
from app.models.sale import Sale, SaleItem, SaleStatus
from app.models.category import Category
from app.models.notification import NotificationType
from app.crud.forecast import demand_forecast as forecast_crud
from app.services.audit import audit_service
from app.crud.notification import notification as notification_crud
from fastapi import Request


class ForecastService:
    PERIOD_DAYS = {
        ForecastPeriodType.NEXT_7_DAYS: 7,
        ForecastPeriodType.NEXT_30_DAYS: 30,
        ForecastPeriodType.NEXT_90_DAYS: 90,
    }

    def _get_period_days(self, forecast_period: ForecastPeriodType, custom_days: Optional[int] = None) -> int:
        if forecast_period == ForecastPeriodType.CUSTOM and custom_days:
            return custom_days
        return self.PERIOD_DAYS.get(forecast_period, 30)

    def _calculate_moving_average(self, sales_data: List[int], window: int = 7) -> float:
        if not sales_data:
            return 0.0
        if len(sales_data) < window:
            return sum(sales_data) / len(sales_data)
        return sum(sales_data[-window:]) / window

    def _calculate_confidence(self, sales_data: List[int], predicted: float) -> float:
        if not sales_data or predicted == 0:
            return 0.0
        variance = sum((x - predicted) ** 2 for x in sales_data) / len(sales_data)
        std_dev = variance ** 0.5
        mean = sum(sales_data) / len(sales_data)
        if mean == 0:
            return 0.0
        cv = std_dev / mean
        confidence = max(0.0, min(100.0, (1 - cv) * 100))
        return round(float(confidence), 2)

    def _get_recommendation(self, current_stock: int, predicted_demand: int, threshold: int) -> RecommendationType:
        if predicted_demand == 0:
            return RecommendationType.STOCK_LEVEL_HEALTHY
        days_of_stock = current_stock / predicted_demand if predicted_demand > 0 else 999
        if current_stock == 0:
            return RecommendationType.IMMEDIATE_RESTOCK_REQUIRED
        if days_of_stock < 7:
            return RecommendationType.IMMEDIATE_RESTOCK_REQUIRED
        if days_of_stock < 14 or current_stock < threshold:
            return RecommendationType.REORDER_SOON
        if current_stock > predicted_demand * 3:
            return RecommendationType.OVERSTOCK_RISK
        return RecommendationType.STOCK_LEVEL_HEALTHY

    async def _get_historical_sales(self, db: AsyncSession, company_id: UUID, product_id: UUID, days_back: int = 90) -> List[int]:
        cutoff = datetime.utcnow() - timedelta(days=days_back)
        result = await db.execute(
            select(Sale.sale_date, func.sum(SaleItem.quantity).label("daily_qty"))
            .join(SaleItem, SaleItem.sale_id == Sale.id)
            .where(Sale.company_id == company_id)
            .where(SaleItem.product_id == product_id)
            .where(Sale.sale_date >= cutoff)
            .where(Sale.status == SaleStatus.COMPLETED)
            .group_by(Sale.sale_date)
            .order_by(Sale.sale_date.asc())
        )
        daily_sales = {row.sale_date.date(): int(row.daily_qty or 0) for row in result.all()}

        days = []
        current = cutoff.date()
        end = datetime.utcnow().date()
        while current <= end:
            days.append(daily_sales.get(current, 0))
            current += timedelta(days=1)

        return days

    async def _get_category_sales(self, db: AsyncSession, company_id: UUID, category_id: UUID, days_back: int = 90) -> List[int]:
        cutoff = datetime.utcnow() - timedelta(days=days_back)
        result = await db.execute(
            select(Sale.sale_date, func.sum(SaleItem.quantity).label("daily_qty"))
            .join(SaleItem, SaleItem.sale_id == Sale.id)
            .where(Sale.company_id == company_id)
            .where(SaleItem.category_id == category_id)
            .where(Sale.sale_date >= cutoff)
            .where(Sale.status == SaleStatus.COMPLETED)
            .group_by(Sale.sale_date)
            .order_by(Sale.sale_date.asc())
        )
        daily_sales = {row.sale_date.date(): int(row.daily_qty or 0) for row in result.all()}

        days = []
        current = cutoff.date()
        end = datetime.utcnow().date()
        while current <= end:
            days.append(daily_sales.get(current, 0))
            current += timedelta(days=1)

        return days

    async def _calculate_forecast_accuracy(self, db: AsyncSession, forecast_id: UUID, product_id: UUID, company_id: UUID) -> Optional[float]:
        forecast = await forecast_crud.get(db, forecast_id)
        if not forecast:
            return None

        actual_result = await db.execute(
            select(func.sum(SaleItem.quantity))
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(Sale.company_id == company_id)
            .where(SaleItem.product_id == product_id)
            .where(Sale.sale_date >= forecast.forecast_start_date)
            .where(Sale.sale_date <= forecast.forecast_end_date)
            .where(Sale.status == SaleStatus.COMPLETED)
        )
        actual_sales = int(actual_result.scalar_one_or_none() or 0)

        if forecast.predicted_demand == 0:
            return 100.0 if actual_sales == 0 else 0.0

        error_rate = abs(forecast.predicted_demand - actual_sales) / forecast.predicted_demand
        accuracy = max(0.0, min(100.0, (1 - error_rate) * 100))
        return round(accuracy, 2)

    async def generate_product_forecast(
        self,
        db: AsyncSession,
        company_id: UUID,
        product_id: UUID,
        forecast_period: ForecastPeriodType,
        forecast_start_date: Optional[datetime] = None,
        forecast_end_date: Optional[datetime] = None,
        custom_days: Optional[int] = None,
    ) -> DemandForecast:
        product = await db.get(Product, product_id)
        if not product or product.company_id != company_id or product.status == ProductStatus.INACTIVE:
            raise ValueError("Product not found or inactive")

        days = self._get_period_days(forecast_period, custom_days)
        sales_data = await self._get_historical_sales(db, company_id, product_id)
        historical_sales = sum(sales_data)

        ma = self._calculate_moving_average(sales_data)
        predicted_demand = int(ma * days)
        confidence = self._calculate_confidence(sales_data, ma)

        recommendation = self._get_recommendation(
            product.stock_quantity - product.reserved_stock,
            predicted_demand,
            product.low_stock_threshold,
        )

        start_date = forecast_start_date or datetime.utcnow()
        end_date = forecast_end_date or (datetime.utcnow() + timedelta(days=days))

        existing = await forecast_crud.get_by_product_period(db, company_id, product_id, forecast_period)
        if existing:
            forecast = await forecast_crud.update(
                db,
                existing,
                forecast_start_date=start_date,
                forecast_end_date=end_date,
                predicted_demand=predicted_demand,
                confidence_score=Decimal(str(confidence)),
                historical_sales=historical_sales,
                recommendation=recommendation,
            )
        else:
            forecast = await forecast_crud.create(
                db,
                company_id=company_id,
                product_id=product_id,
                category_id=product.category_id,
                forecast_period=forecast_period,
                forecast_start_date=start_date,
                forecast_end_date=end_date,
                predicted_demand=predicted_demand,
                confidence_score=Decimal(str(confidence)),
                historical_sales=historical_sales,
                recommendation=recommendation,
            )

        await forecast_crud.create_history(
            db, forecast_id=forecast.id, historical_sales=historical_sales, prediction=predicted_demand, accuracy=confidence
        )

        return forecast

    async def generate_forecasts(
        self,
        db: AsyncSession,
        company_id: UUID,
        forecast_period: ForecastPeriodType,
        forecast_start_date: Optional[datetime] = None,
        forecast_end_date: Optional[datetime] = None,
        custom_days: Optional[int] = None,
    ) -> List[DemandForecast]:
        result = await db.execute(
            select(Product.id)
            .where(Product.company_id == company_id)
            .where(Product.status == ProductStatus.ACTIVE)
            .where(Product.stock_quantity.isnot(None))
        )
        product_ids = [row[0] for row in result.all()]

        if not product_ids:
            raise ValueError("No active products found")

        forecasts = []
        for pid in product_ids:
            try:
                f = await self.generate_product_forecast(
                    db, company_id, pid, forecast_period, forecast_start_date, forecast_end_date, custom_days
                )
                forecasts.append(f)
            except Exception:
                continue

        return forecasts

    async def refresh_forecasts(
        self,
        db: AsyncSession,
        company_id: UUID,
        forecast_period: ForecastPeriodType,
        request: Request,
    ) -> List[DemandForecast]:
        await forecast_crud.delete_by_period(db, company_id, forecast_period)
        return await self.generate_forecasts(db, company_id, forecast_period)

    async def _notify_if_needed(self, db: AsyncSession, company_id: UUID, forecast: DemandForecast):
        product = await db.get(Product, forecast.product_id)
        if not product:
            return

        available = product.stock_quantity - product.reserved_stock

        if forecast.recommendation == RecommendationType.IMMEDIATE_RESTOCK_REQUIRED:
            await notification_crud.create(
                db=db,
                company_id=company_id,
                title="Immediate Restock Required",
                message=f"Product '{product.name}' (SKU: {product.sku}) is predicted to run out of stock. Predicted demand: {forecast.predicted_demand}, Available: {available}",
                type=NotificationType.LOW_STOCK,
            )
        elif forecast.recommendation == RecommendationType.REORDER_SOON:
            await notification_crud.create(
                db=db,
                company_id=company_id,
                title="Reorder Soon",
                message=f"Product '{product.name}' (SKU: {product.sku}) should be reordered soon. Predicted demand: {forecast.predicted_demand}, Available: {available}",
                type=NotificationType.LOW_STOCK,
            )
        elif forecast.recommendation == RecommendationType.OVERSTOCK_RISK:
            await notification_crud.create(
                db=db,
                company_id=company_id,
                title="Overstock Risk",
                message=f"Product '{product.name}' (SKU: {product.sku}) may have overstock risk. Current stock: {available}, Predicted demand: {forecast.predicted_demand}",
                type=NotificationType.SYSTEM,
            )

    async def generate_with_notifications(
        self,
        db: AsyncSession,
        company_id: UUID,
        user_id: UUID,
        forecast_period: ForecastPeriodType,
        request: Request,
        forecast_start_date: Optional[datetime] = None,
        forecast_end_date: Optional[datetime] = None,
        custom_days: Optional[int] = None,
    ) -> List[DemandForecast]:
        forecasts = await self.generate_forecasts(
            db, company_id, forecast_period, forecast_start_date, forecast_end_date, custom_days
        )
        for f in forecasts:
            await self._notify_if_needed(db, company_id, f)

        await audit_service.log(
            db=db,
            company_id=company_id,
            user_id=user_id,
            action="Forecast Generated",
            request=request,
            entity_name=f"Forecast {forecast_period}",
            details=f"Generated {len(forecasts)} product forecasts for period {forecast_period}",
        )
        await db.commit()
        return forecasts

    async def refresh_with_notifications(
        self,
        db: AsyncSession,
        company_id: UUID,
        user_id: UUID,
        forecast_period: ForecastPeriodType,
        request: Request,
    ) -> List[DemandForecast]:
        forecasts = await self.refresh_forecasts(db, company_id, forecast_period, request)
        for f in forecasts:
            await self._notify_if_needed(db, company_id, f)

        await audit_service.log(
            db=db,
            company_id=company_id,
            user_id=user_id,
            action="Forecast Refreshed",
            request=request,
            entity_name=f"Forecast {forecast_period}",
            details=f"Refreshed {len(forecasts)} product forecasts for period {forecast_period}",
        )
        await db.commit()
        return forecasts

    async def get_chart_data(
        self, db: AsyncSession, company_id: UUID, forecast_period: ForecastPeriodType
    ) -> dict:
        result = await db.execute(
            select(DemandForecast)
            .where(DemandForecast.company_id == company_id)
            .where(DemandForecast.forecast_period == forecast_period)
            .order_by(DemandForecast.predicted_demand.desc())
            .limit(10)
        )
        top = result.scalars().all()

        product_names = []
        predicted = []
        historical = []
        for f in top:
            product = await db.get(Product, f.product_id)
            product_names.append(product.name if product else "Unknown")
            predicted.append(f.predicted_demand)
            historical.append(f.historical_sales)

        return {
            "top_predicted_products": product_names,
            "predicted_demand": predicted,
            "historical_sales": historical,
        }

    async def get_forecast_accuracy_trend(self, db: AsyncSession, company_id: UUID) -> List[dict]:
        result = await db.execute(
            select(ForecastHistory)
            .join(DemandForecast, ForecastHistory.forecast_id == DemandForecast.id)
            .where(DemandForecast.company_id == company_id)
            .order_by(ForecastHistory.created_at.asc())
            .limit(50)
        )
        histories = result.scalars().all()
        return [
            {
                "period": h.created_at.strftime("%Y-%m-%d"),
                "historical": h.historical_sales,
                "prediction": h.prediction,
                "accuracy": float(h.accuracy) if h.accuracy else None,
            }
            for h in histories
        ]


forecast_service = ForecastService()
