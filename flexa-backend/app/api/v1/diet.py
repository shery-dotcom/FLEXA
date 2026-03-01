"""
Module 3 – Diet & Calorie Planner API Routes
Base prefix: /api/v1/diet

Endpoints:
  POST  /calculate-calories       → BMR/TDEE/macro calculation
  POST  /generate-plan            → AI meal plan generation
  GET   /preferences              → Get user diet preferences
  PUT   /preferences              → Save/update user diet preferences
  POST  /log-meal                 → Add food to daily log
  GET   /daily-summary            → Today's calorie/macro summary
  GET   /meal-logs                → Paginated meal history
  DELETE /meal-logs/{log_id}      → Remove a meal log entry
  GET   /search-foods             → Search nutrition_foods table
  POST  /upload-meal-image        → AI calorie estimation from image
"""
import os
from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.diet import NutritionFood, UserDietPreference, DailyMealLog, ImageAnalysisLog
from app.schemas.diet import (
    CalorieCalculatorRequest, CalorieCalculatorResponse,
    DietPlanRequest, DietPlanResponse,
    MealLogCreate, MealLogResponse, DailySummaryResponse,
    FoodSearchResult, DietPreferenceUpdate, DietPreferenceResponse,
    ImageAnalysisResponse, MealSuggestion,
)
from app.services.calorie_engine import run_calorie_calculator
from app.services.meal_recommender import generate_meal_plan
from app.services.diet_service import get_current_reminders
from app.ml.food_classifier import predict_from_image_bytes, map_prediction_to_nutrition

router = APIRouter(prefix="/diet", tags=["Module 3 – Diet & Calorie Planner"])

# Max image upload size: 10 MB
MAX_IMAGE_SIZE = 10 * 1024 * 1024


# ───────────────────────────────────────────────────────────────────────────
# 1. Calorie Calculator
# ───────────────────────────────────────────────────────────────────────────

@router.post("/calculate-calories", response_model=CalorieCalculatorResponse)
async def calculate_calories(
    req: CalorieCalculatorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Compute BMR (Mifflin-St Jeor), TDEE, goal-adjusted calorie target,
    macronutrient split, and daily water recommendation.
    Also upserts the result into user_diet_preferences.
    """
    result = run_calorie_calculator(req)

    # Upsert preferences with computed values
    stmt = select(UserDietPreference).where(UserDietPreference.user_id == current_user.id)
    pref_result = await db.execute(stmt)
    pref = pref_result.scalar_one_or_none()

    if pref is None:
        pref = UserDietPreference(user_id=current_user.id)
        db.add(pref)

    pref.age                  = req.age
    pref.gender               = req.gender
    pref.weight_kg            = req.weight_kg
    pref.height_cm            = req.height_cm
    pref.activity_level       = req.activity_level
    pref.goal                 = req.goal
    pref.bmr                  = result.bmr
    pref.tdee                 = result.tdee
    pref.daily_calorie_target = result.calorie_target
    pref.protein_target_g     = result.protein_g
    pref.carbs_target_g       = result.carbs_g
    pref.fat_target_g         = result.fat_g
    pref.water_target_ml      = result.water_ml

    await db.commit()
    return result


# ───────────────────────────────────────────────────────────────────────────
# 2. Generate Diet Plan
# ───────────────────────────────────────────────────────────────────────────

@router.post("/generate-plan", response_model=DietPlanResponse)
async def generate_diet_plan(
    req: DietPlanRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a one-day meal plan using content-based filtering.
    Respects region, diet type, allergens, and calorie target.
    Call /calculate-calories first to get calorie_target and macros.
    """
    # Update preferences with latest filter settings
    stmt = select(UserDietPreference).where(UserDietPreference.user_id == current_user.id)
    r = await db.execute(stmt)
    pref = r.scalar_one_or_none()

    if pref is None:
        pref = UserDietPreference(user_id=current_user.id)
        db.add(pref)

    pref.region        = req.region
    pref.diet_type     = ",".join(req.diet_type) if isinstance(req.diet_type, list) else req.diet_type
    pref.allergies     = req.allergies
    pref.meals_per_day = req.meals_per_day
    await db.commit()

    plan = await generate_meal_plan(
        db=db,
        calorie_target=req.calorie_target,
        protein_g=req.protein_g,
        carbs_g=req.carbs_g,
        fat_g=req.fat_g,
        region=req.region,
        diet_types=req.diet_type if isinstance(req.diet_type, list) else [req.diet_type],
        allergies=req.allergies,
        meals_per_day=req.meals_per_day,
    )
    # Inject water target from stored preference
    plan.water_ml = pref.water_target_ml or 2500.0
    return plan


# ───────────────────────────────────────────────────────────────────────────
# 3. User Diet Preferences
# ───────────────────────────────────────────────────────────────────────────

@router.get("/preferences", response_model=DietPreferenceResponse)
async def get_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(UserDietPreference).where(UserDietPreference.user_id == current_user.id)
    r = await db.execute(stmt)
    pref = r.scalar_one_or_none()
    if not pref:
        raise HTTPException(status_code=404, detail="No diet preferences set. Run /calculate-calories first.")
    return pref


@router.put("/preferences", response_model=DietPreferenceResponse)
async def update_preferences(
    updates: DietPreferenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(UserDietPreference).where(UserDietPreference.user_id == current_user.id)
    r = await db.execute(stmt)
    pref = r.scalar_one_or_none()
    if not pref:
        raise HTTPException(status_code=404, detail="Run /calculate-calories first.")

    if updates.region        is not None: pref.region        = updates.region
    if updates.diet_type     is not None: pref.diet_type     = ",".join(updates.diet_type) if isinstance(updates.diet_type, list) else updates.diet_type
    if updates.allergies     is not None: pref.allergies     = updates.allergies
    if updates.meals_per_day is not None: pref.meals_per_day = updates.meals_per_day

    await db.commit()
    await db.refresh(pref)
    return pref


# ───────────────────────────────────────────────────────────────────────────
# 4. Meal Logging
# ───────────────────────────────────────────────────────────────────────────

@router.post("/log-meal", response_model=MealLogResponse, status_code=201)
async def log_meal(
    payload: MealLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Add a food item to the user's daily meal log.
    If food_id is provided, macros are calculated from the nutrition_foods table.
    Otherwise food_name is stored with zero macros (manual entry).
    """
    calories = protein = carbs = fat = 0.0
    resolved_from_db = False

    if payload.food_id:
        stmt = select(NutritionFood).where(NutritionFood.id == payload.food_id)
        r = await db.execute(stmt)
        food = r.scalar_one_or_none()
        if food:
            scale = payload.quantity_g / 100.0
            calories = round(food.calories   * scale, 1)
            protein  = round(food.protein_g  * scale, 1)
            carbs    = round(food.carbs_g    * scale, 1)
            fat      = round(food.fat_g      * scale, 1)
            resolved_from_db = True

    # Use pre-computed macros from payload (e.g. plan items with id=0)
    if not resolved_from_db:
        if payload.calories  is not None: calories = payload.calories
        if payload.protein_g is not None: protein  = payload.protein_g
        if payload.carbs_g   is not None: carbs    = payload.carbs_g
        if payload.fat_g     is not None: fat      = payload.fat_g

    log = DailyMealLog(
        user_id=current_user.id,
        food_id=payload.food_id,
        food_name=payload.food_name,
        meal_type=payload.meal_type,
        quantity_g=payload.quantity_g,
        calories_consumed=calories,
        protein_consumed_g=protein,
        carbs_consumed_g=carbs,
        fat_consumed_g=fat,
        notes=payload.notes,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


@router.get("/meal-logs", response_model=List[MealLogResponse])
async def get_meal_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(DailyMealLog)
        .where(DailyMealLog.user_id == current_user.id)
        .order_by(DailyMealLog.logged_at.desc())
        .offset(skip).limit(limit)
    )
    r = await db.execute(stmt)
    return r.scalars().all()


@router.delete("/meal-logs/{log_id}", status_code=204)
async def delete_meal_log(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(DailyMealLog).where(
        DailyMealLog.id == log_id,
        DailyMealLog.user_id == current_user.id,
    )
    r = await db.execute(stmt)
    log = r.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found.")
    await db.delete(log)
    await db.commit()


class MealLogUpdate(BaseModel):
    meal_type: Optional[str] = None       # FE-4: change timing slot
    quantity_g: Optional[float] = None    # FE-4: change portion size
    notes: Optional[str] = None


@router.patch("/meal-logs/{log_id}", response_model=MealLogResponse)
async def update_meal_log(
    log_id: int,
    updates: MealLogUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    FE-4: Edit a logged meal — change meal timing slot or serving size.
    Macros are re-scaled if quantity_g changes and food_id is linked.
    """
    stmt = select(DailyMealLog).where(
        DailyMealLog.id == log_id,
        DailyMealLog.user_id == current_user.id,
    )
    r = await db.execute(stmt)
    log = r.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found.")

    if updates.meal_type is not None:
        log.meal_type = updates.meal_type
    if updates.notes is not None:
        log.notes = updates.notes
    if updates.quantity_g is not None and updates.quantity_g > 0:
        new_qty = updates.quantity_g
        # Re-scale macros from linked NutritionFood if available
        if log.food_id:
            fs = select(NutritionFood).where(NutritionFood.id == log.food_id)
            fr = await db.execute(fs)
            food = fr.scalar_one_or_none()
            if food:
                scale = new_qty / 100.0
                log.calories_consumed   = round(food.calories   * scale, 1)
                log.protein_consumed_g  = round(food.protein_g  * scale, 1)
                log.carbs_consumed_g    = round(food.carbs_g    * scale, 1)
                log.fat_consumed_g      = round(food.fat_g      * scale, 1)
        log.quantity_g = new_qty

    await db.commit()
    await db.refresh(log)
    return log


# ───────────────────────────────────────────────────────────────────────────
# 5. Daily Summary
# ───────────────────────────────────────────────────────────────────────────

@router.get("/daily-summary", response_model=DailySummaryResponse)
async def get_daily_summary(
    log_date: Optional[str] = Query(None, description="YYYY-MM-DD (default: today)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_date = date.fromisoformat(log_date) if log_date else date.today()
    day_start = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0)
    day_end   = datetime(target_date.year, target_date.month, target_date.day, 23, 59, 59)

    # Get logs for the day
    stmt = (
        select(DailyMealLog)
        .where(
            DailyMealLog.user_id == current_user.id,
            DailyMealLog.logged_at >= day_start,
            DailyMealLog.logged_at <= day_end,
        )
        .order_by(DailyMealLog.logged_at)
    )
    r = await db.execute(stmt)
    logs = r.scalars().all()

    # Get targets from preferences
    pref_stmt = select(UserDietPreference).where(UserDietPreference.user_id == current_user.id)
    pr = await db.execute(pref_stmt)
    pref = pr.scalar_one_or_none()

    cal_target     = (pref.daily_calorie_target or 2000.0) if pref else 2000.0
    protein_target = (pref.protein_target_g     or 50.0)   if pref else 50.0
    carbs_target   = (pref.carbs_target_g       or 250.0)  if pref else 250.0
    fat_target     = (pref.fat_target_g         or 65.0)   if pref else 65.0
    water_target   = (pref.water_target_ml      or 2500.0) if pref else 2500.0

    total_cal  = sum((l.calories_consumed   or 0.0) for l in logs)
    total_pro  = sum((l.protein_consumed_g  or 0.0) for l in logs)
    total_carb = sum((l.carbs_consumed_g    or 0.0) for l in logs)
    total_fat  = sum((l.fat_consumed_g      or 0.0) for l in logs)

    return DailySummaryResponse(
        date=target_date.isoformat(),
        calorie_target=cal_target,
        calories_consumed=round(total_cal, 1),
        protein_target_g=protein_target,
        protein_consumed_g=round(total_pro, 1),
        carbs_target_g=carbs_target,
        carbs_consumed_g=round(total_carb, 1),
        fat_target_g=fat_target,
        fat_consumed_g=round(total_fat, 1),
        water_target_ml=water_target,
        meals=logs,
        calorie_remaining=round(cal_target - total_cal, 1),
        on_track=(total_cal <= cal_target * 1.05),
    )


# ───────────────────────────────────────────────────────────────────────────
# 6. Food Search
# ───────────────────────────────────────────────────────────────────────────

@router.get("/search-foods", response_model=List[FoodSearchResult])
async def search_foods(
    query: str = Query(..., min_length=2),
    diet_type: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    meal_type: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(NutritionFood)
        .where(NutritionFood.food_name.ilike(f"%{query}%"))
        .limit(limit)
    )
    if diet_type:
        stmt = stmt.where(NutritionFood.diet_type == diet_type)
    if region:
        stmt = stmt.where(NutritionFood.region.ilike(f"%{region}%"))
    if meal_type:
        stmt = stmt.where(NutritionFood.meal_type == meal_type)

    r = await db.execute(stmt)
    return r.scalars().all()


# ───────────────────────────────────────────────────────────────────────────
# 7. Hydration & Meal Reminders  (FE-5)
# ───────────────────────────────────────────────────────────────────────────

@router.get("/reminders")
async def get_reminders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the applicable hydration tip and meal reminder for the current
    time of day, based on the user's stored water target.
    No push scheduler needed — call this on page load or on a client-side interval.
    """
    stmt = select(UserDietPreference).where(UserDietPreference.user_id == current_user.id)
    r = await db.execute(stmt)
    pref = r.scalar_one_or_none()
    water_target = pref.water_target_ml if pref else 2500.0
    return get_current_reminders(water_target_ml=water_target)


# ───────────────────────────────────────────────────────────────────────────
# 8. Image-based Calorie Estimation  (FE-6, FE-7)
# ───────────────────────────────────────────────────────────────────────────

@router.post("/upload-meal-image", response_model=ImageAnalysisResponse)
async def upload_meal_image(
    image: UploadFile = File(..., description="JPEG or PNG food image"),
    portion_g: float = Query(150.0, ge=10, le=2000, description="Estimated portion weight in grams"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a food image → AI predicts food class → maps to USDA nutrition DB
    → returns estimated calories and macros for the given portion size.

    If the model is not yet trained, returns a low-confidence fallback.
    """
    # Validate file type
    content_type = image.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (JPEG/PNG).")

    image_bytes = await image.read()
    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Image too large. Max 10 MB.")

    # Run inference
    predicted_class, confidence = predict_from_image_bytes(image_bytes)
    low_confidence = confidence < 0.50

    # Map to nutrition DB
    nutrition = await map_prediction_to_nutrition(predicted_class, db, portion_g)

    cal = nutrition["calories"]   if nutrition else round(portion_g * 1.5, 1)
    pro = nutrition["protein_g"]  if nutrition else round(portion_g * 0.10, 1)
    carb = nutrition["carbs_g"]   if nutrition else round(portion_g * 0.20, 1)
    fat = nutrition["fat_g"]      if nutrition else round(portion_g * 0.05, 1)

    # Persist analysis log
    log = ImageAnalysisLog(
        user_id=current_user.id,
        image_filename=image.filename or "upload",
        predicted_class=predicted_class,
        confidence=confidence,
        portion_g=portion_g,
        estimated_calories=cal,
        estimated_protein_g=pro,
        estimated_carbs_g=carb,
        estimated_fat_g=fat,
    )
    db.add(log)
    await db.commit()

    # Build matched food response
    matched = None
    if nutrition and nutrition.get("food_id"):
        stmt = select(NutritionFood).where(NutritionFood.id == nutrition["food_id"])
        fres = await db.execute(stmt)
        food_row = fres.scalar_one_or_none()
        if food_row:
            matched = FoodSearchResult.model_validate(food_row)

    return ImageAnalysisResponse(
        predicted_class=predicted_class,
        confidence=confidence,
        portion_g=portion_g,
        estimated_calories=cal,
        estimated_protein_g=pro,
        estimated_carbs_g=carb,
        estimated_fat_g=fat,
        low_confidence=low_confidence,
        matched_food=matched,
        message=(
            "⚠️ Low confidence prediction. Please verify manually."
            if low_confidence
            else f"✅ Detected: {predicted_class.title()} ({confidence:.0%} confidence)"
        ),
    )
