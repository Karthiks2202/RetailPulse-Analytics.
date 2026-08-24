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
            select(func.date(Sale.sale_date).label("sale_day"), func.sum(SaleItem.quantity).label("daily_qty"))
            .join(SaleItem, SaleItem.sale_id == Sale.id)
            .where(Sale.company_id == company_id)
            .where(SaleItem.product_id == product_id)
            .where(Sale.sale_date >= cutoff)
            .where(Sale.status == SaleStatus.COMPLETED)
            .group_by(func.date(Sale.sale_date))
            .order_by(func.date(Sale.sale_date).asc())
        )
        daily_sales = {}
        for row in result.all():
            day = row.sale_day
            if isinstance(day, str):
                day = datetime.strptime(day, "%Y-%m-%d").date()
            daily_sales[day] = int(row.daily_qty or 0)

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
            select(func.date(Sale.sale_date).label("sale_day"), func.sum(SaleItem.quantity).label("daily_qty"))
            .join(SaleItem, SaleItem.sale_id == Sale.id)
            .where(Sale.company_id == company_id)
            .where(SaleItem.category_id == category_id)
            .where(Sale.sale_date >= cutoff)
            .where(Sale.status == SaleStatus.COMPLETED)
            .group_by(func.date(Sale.sale_date))
            .order_by(func.date(Sale.sale_date).asc())
        )
        daily_sales = {}
        for row in result.all():
            day = row.sale_day
            if isinstance(day, str):
                day = datetime.strptime(day, "%Y-%m-%d").date()
            daily_sales[day] = int(row.daily_qty or 0)

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
            db, forecast_id=forecast.id, historical_sales=historical_sales, prediction=predicted_demand
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

    async def refresh_accuracy_for_expired_forecasts(self, db: AsyncSession, company_id: UUID) -> int:
        result = await db.execute(
            select(DemandForecast)
            .where(DemandForecast.company_id == company_id)
            .where(DemandForecast.forecast_end_date < datetime.utcnow())
        )
        forecasts = result.scalars().all()
        updated = 0
        for forecast in forecasts:
            accuracy = await self._calculate_forecast_accuracy(db, forecast.id, forecast.product_id, company_id)
            if accuracy is not None:
                history_result = await db.execute(
                    select(ForecastHistory)
                    .where(ForecastHistory.forecast_id == forecast.id)
                    .order_by(ForecastHistory.created_at.desc())
                    .limit(1)
                )
                history = history_result.scalar_one_or_none()
                if history:
                    history.accuracy = Decimal(str(accuracy))
                    updated += 1
        if updated:
            await db.commit()
        return updated

    def _calculate_stock_risk(
        self,
        current_stock: int,
        available_stock: int,
        avg_daily_sales: float,
        reorder_point: int,
        forecasted_demand: int,
    ) -> str:
        if current_stock == 0:
            return "OUT_OF_STOCK"
        if avg_daily_sales > 0:
            days_remaining = available_stock / avg_daily_sales
        else:
            days_remaining = 9999.0
        if days_remaining < 7:
            return "STOCKOUT_RISK"
        if available_stock <= reorder_point:
            return "LOW_STOCK"
        if current_stock > forecasted_demand * 2 and forecasted_demand > 0:
            return "OVERSTOCK"
        return "HEALTHY"

    def _calculate_recommendation_text(self, stock_risk: str, recommended_qty: int, days_remaining: float) -> str:
        if stock_risk == "OUT_OF_STOCK":
            return "Immediate restock required"
        if stock_risk == "STOCKOUT_RISK":
            return "Reorder immediately"
        if stock_risk == "LOW_STOCK":
            return "Reorder soon"
        if stock_risk == "OVERSTOCK":
            return "Reduce orders or promote sales"
        if recommended_qty > 0:
            return "Consider reordering"
        return "No action needed"

    def _calculate_reorder_point(self, avg_daily_sales: float, lead_time_days: int, safety_stock: int) -> int:
        if avg_daily_sales <= 0:
            return safety_stock
        return int((avg_daily_sales * lead_time_days) + safety_stock)

    def _calculate_recommended_quantity(
        self,
        current_stock: int,
        reorder_point: int,
        forecasted_demand: int,
        safety_stock: int,
    ) -> int:
        target = reorder_point + max(forecasted_demand, safety_stock)
        qty = target - current_stock
        return max(0, qty)

    async def _get_avg_daily_sales(self, db: AsyncSession, company_id: UUID, product_id: UUID, days_back: int = 90) -> float:
        cutoff = datetime.utcnow() - timedelta(days=days_back)
        result = await db.execute(
            select(func.coalesce(func.sum(SaleItem.quantity), 0))
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(Sale.company_id == company_id)
            .where(SaleItem.product_id == product_id)
            .where(Sale.sale_date >= cutoff)
            .where(Sale.status == SaleStatus.COMPLETED)
        )
        total_qty = int(result.scalar_one_or_none() or 0)
        if total_qty == 0:
            return 0.0
        return round(total_qty / days_back, 2)

    async def _get_latest_forecast_for_product(
        self, db: AsyncSession, company_id: UUID, product_id: UUID, forecast_period: ForecastPeriodType
    ) -> DemandForecast | None:
        result = await db.execute(
            select(DemandForecast)
            .where(DemandForecast.company_id == company_id)
            .where(DemandForecast.product_id == product_id)
            .where(DemandForecast.forecast_period == forecast_period)
            .order_by(DemandForecast.generated_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_inventory_forecasts(
        self,
        db: AsyncSession,
        company_id: UUID,
        forecast_period: ForecastPeriodType = ForecastPeriodType.NEXT_30_DAYS,
        category_id: Optional[UUID] = None,
        brand: Optional[str] = None,
        stock_risk: Optional[str] = None,
        reorder_required: Optional[bool] = None,
        search: Optional[str] = None,
        sort_by: str = "days_of_stock_remaining",
        sort_dir: str = "asc",
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[dict], int]:
        period_days = self._get_period_days(forecast_period)
        lead_time_days = 7

        product_query = select(Product).where(Product.company_id == company_id).where(Product.status == ProductStatus.ACTIVE)
        if category_id:
            product_query = product_query.where(Product.category_id == category_id)
        if brand:
            product_query = product_query.where(Product.brand.ilike(f"%{brand}%"))
        if search:
            product_query = product_query.where(
                Product.name.ilike(f"%{search}%") | Product.sku.ilike(f"%{search}%")
            )

        count_query = select(func.count()).select_from(product_query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        fetch_limit = limit * 10 if (stock_risk or reorder_required is not None) else limit
        product_query = product_query.offset(0).limit(fetch_limit)
        products_result = await db.execute(product_query)
        products = list(products_result.scalars().all())

        items = []
        for product in products:
            available = product.stock_quantity - product.reserved_stock
            avg_daily_sales = await self._get_avg_daily_sales(db, company_id, product.id)

            forecast = await self._get_latest_forecast_for_product(db, company_id, product.id, forecast_period)
            if forecast:
                forecasted_demand = forecast.predicted_demand
                confidence_score = float(forecast.confidence_score)
                historical_sales = forecast.historical_sales
            else:
                sales_data = await self._get_historical_sales(db, company_id, product.id)
                historical_sales = sum(sales_data)
                ma = self._calculate_moving_average(sales_data)
                forecasted_demand = int(ma * period_days)
                confidence_score = self._calculate_confidence(sales_data, ma)

            safety_stock = product.low_stock_threshold
            reorder_point = self._calculate_reorder_point(avg_daily_sales, lead_time_days, safety_stock)
            recommended_qty = self._calculate_recommended_quantity(
                product.stock_quantity, reorder_point, forecasted_demand, safety_stock
            )

            if avg_daily_sales > 0:
                days_remaining = round(available / avg_daily_sales, 1)
            else:
                days_remaining = 9999.0

            stock_risk_val = self._calculate_stock_risk(
                product.stock_quantity, available, avg_daily_sales, reorder_point, forecasted_demand
            )
            recommendation = self._calculate_recommendation_text(stock_risk_val, recommended_qty, days_remaining)

            cat_name = None
            if product.category_id:
                cat = await db.get(Category, product.category_id)
                if cat:
                    cat_name = cat.name

            items.append({
                "product_id": product.id,
                "product_name": product.name,
                "product_sku": product.sku,
                "category_id": product.category_id,
                "category_name": cat_name,
                "brand": product.brand,
                "current_stock": product.stock_quantity,
                "available_stock": available,
                "reserved_stock": product.reserved_stock,
                "average_daily_sales": avg_daily_sales,
                "forecasted_demand": forecasted_demand,
                "days_of_stock_remaining": days_remaining,
                "reorder_point": reorder_point,
                "recommended_reorder_quantity": recommended_qty,
                "stock_risk": stock_risk_val,
                "recommendation": recommendation,
                "confidence_score": confidence_score,
                "forecast_period": forecast_period.value,
                "lead_time_days": lead_time_days,
                "safety_stock": safety_stock,
                "historical_sales": historical_sales,
                "low_stock_threshold": product.low_stock_threshold,
            })

        if stock_risk:
            items = [i for i in items if i["stock_risk"] == stock_risk]
        if reorder_required is not None:
            if reorder_required:
                items = [i for i in items if i["recommended_reorder_quantity"] > 0 or i["stock_risk"] in ("OUT_OF_STOCK", "STOCKOUT_RISK", "LOW_STOCK")]
            else:
                items = [i for i in items if i["recommended_reorder_quantity"] == 0 and i["stock_risk"] not in ("OUT_OF_STOCK", "STOCKOUT_RISK", "LOW_STOCK")]

        sort_map = {
            "days_of_stock_remaining": lambda x: x["days_of_stock_remaining"],
            "current_stock": lambda x: x["current_stock"],
            "forecasted_demand": lambda x: x["forecasted_demand"],
            "recommended_reorder_quantity": lambda x: x["recommended_reorder_quantity"],
            "product_name": lambda x: x["product_name"].lower(),
            "average_daily_sales": lambda x: x["average_daily_sales"],
            "reorder_point": lambda x: x["reorder_point"],
        }
        sort_key = sort_map.get(sort_by, lambda x: x["days_of_stock_remaining"])
        items.sort(key=sort_key, reverse=(sort_dir == "desc"))

        filtered_total = len(items)
        paginated = items[skip:skip + limit] if skip < len(items) else []

        return paginated, filtered_total

    async def get_recommendations(
        self,
        db: AsyncSession,
        company_id: UUID,
        forecast_period: ForecastPeriodType = ForecastPeriodType.NEXT_30_DAYS,
        category_id: Optional[UUID] = None,
        search: Optional[str] = None,
        sort_by: str = "days_of_stock_remaining",
        sort_dir: str = "asc",
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[dict], int]:
        items, _ = await self.get_inventory_forecasts(
            db,
            company_id,
            forecast_period=forecast_period,
            category_id=category_id,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
            skip=0,
            limit=limit * 10,
        )
        items = [i for i in items if i["recommended_reorder_quantity"] > 0 or i["stock_risk"] in ("OUT_OF_STOCK", "STOCKOUT_RISK", "LOW_STOCK")]
        total = len(items)
        paginated = items[skip:skip + limit] if skip < len(items) else []
        return paginated, total

    async def get_product_recommendation(
        self,
        db: AsyncSession,
        company_id: UUID,
        product_id: UUID,
        forecast_period: ForecastPeriodType = ForecastPeriodType.NEXT_30_DAYS,
    ) -> dict | None:
        product = await db.get(Product, product_id)
        if not product or product.company_id != company_id or product.status == ProductStatus.INACTIVE:
            return None

        period_days = self._get_period_days(forecast_period)
        lead_time_days = 7
        available = product.stock_quantity - product.reserved_stock
        avg_daily_sales = await self._get_avg_daily_sales(db, company_id, product.id)

        forecast = await self._get_latest_forecast_for_product(db, company_id, product.id, forecast_period)
        if forecast:
            forecasted_demand = forecast.predicted_demand
            confidence_score = float(forecast.confidence_score)
            historical_sales = forecast.historical_sales
        else:
            sales_data = await self._get_historical_sales(db, company_id, product.id)
            historical_sales = sum(sales_data)
            ma = self._calculate_moving_average(sales_data)
            forecasted_demand = int(ma * period_days)
            confidence_score = self._calculate_confidence(sales_data, ma)

        safety_stock = product.low_stock_threshold
        reorder_point = self._calculate_reorder_point(avg_daily_sales, lead_time_days, safety_stock)
        recommended_qty = self._calculate_recommended_quantity(
            product.stock_quantity, reorder_point, forecasted_demand, safety_stock
        )

        if avg_daily_sales > 0:
            days_remaining = round(available / avg_daily_sales, 1)
        else:
            days_remaining = 9999.0

        stock_risk = self._calculate_stock_risk(
            product.stock_quantity, available, avg_daily_sales, reorder_point, forecasted_demand
        )
        recommendation = self._calculate_recommendation_text(stock_risk, recommended_qty, days_remaining)

        cat_name = None
        if product.category_id:
            cat = await db.get(Category, product.category_id)
            if cat:
                cat_name = cat.name

        return {
            "product_id": product.id,
            "product_name": product.name,
            "product_sku": product.sku,
            "category_id": product.category_id,
            "category_name": cat_name,
            "brand": product.brand,
            "current_stock": product.stock_quantity,
            "available_stock": available,
            "reserved_stock": product.reserved_stock,
            "average_daily_sales": avg_daily_sales,
            "forecasted_demand": forecasted_demand,
            "days_of_stock_remaining": days_remaining,
            "reorder_point": reorder_point,
            "recommended_reorder_quantity": recommended_qty,
            "stock_risk": stock_risk,
            "recommendation": recommendation,
            "confidence_score": confidence_score,
            "forecast_period": forecast_period.value,
            "lead_time_days": lead_time_days,
            "safety_stock": safety_stock,
            "historical_sales": historical_sales,
            "low_stock_threshold": product.low_stock_threshold,
        }

    async def get_inventory_forecast_summary(
        self,
        db: AsyncSession,
        company_id: UUID,
        forecast_period: ForecastPeriodType = ForecastPeriodType.NEXT_30_DAYS,
    ) -> dict:
        items, _ = await self.get_inventory_forecasts(
            db, company_id, forecast_period=forecast_period, skip=0, limit=1000
        )
        total_products = len(items)
        products_requiring_reorder = sum(1 for i in items if i["recommended_reorder_quantity"] > 0 or i["stock_risk"] in ("OUT_OF_STOCK", "STOCKOUT_RISK", "LOW_STOCK"))
        products_at_stockout_risk = sum(1 for i in items if i["stock_risk"] in ("OUT_OF_STOCK", "STOCKOUT_RISK"))
        overstocked_products = sum(1 for i in items if i["stock_risk"] == "OVERSTOCK")
        healthy_products = sum(1 for i in items if i["stock_risk"] == "HEALTHY")
        return {
            "total_products": total_products,
            "products_requiring_reorder": products_requiring_reorder,
            "products_at_stockout_risk": products_at_stockout_risk,
            "overstocked_products": overstocked_products,
            "healthy_products": healthy_products,
        }


forecast_service = ForecastService()
