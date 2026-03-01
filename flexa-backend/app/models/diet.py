"""
Module 3 – Diet & Calorie Planner Data Models
Tables: nutrition_foods, user_diet_preferences, daily_meal_logs, image_analysis_logs
"""
import uuid as _uuid
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Text, ForeignKey, JSON, Boolean
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class NutritionFood(Base):
    """
    Unified food/meal database populated from:
    - USDA FoodData Central (normalized per 100g)
    - Food.com recipes (aggregated macros)
    - Custom Pakistani meals CSV
    """
    __tablename__ = "nutrition_foods"

    id            = Column(Integer, primary_key=True, index=True)
    food_name     = Column(String(500), nullable=False, index=True)
    calories      = Column(Float, nullable=False)          # kcal per 100g
    protein_g     = Column(Float, default=0.0)             # g per 100g
    carbs_g       = Column(Float, default=0.0)             # g per 100g
    fat_g         = Column(Float, default=0.0)             # g per 100g
    fiber_g       = Column(Float, default=0.0)             # g per 100g
    serving_size_g = Column(Float, default=100.0)          # standard serving
    meal_type     = Column(String(50),  default="any")     # breakfast/lunch/dinner/snack
    cuisine       = Column(String(100), default="general")
    diet_type     = Column(String(100), default="non-vegetarian")  # vegetarian/vegan/keto
    allergens     = Column(String(500), default="")        # comma-separated
    ingredients   = Column(Text, default="")
    region        = Column(String(100), default="general") # punjabi/sindhi/balochi/etc
    source        = Column(String(50),  default="usda")    # usda/foodcom/custom
    created_at    = Column(DateTime, default=datetime.utcnow)


class UserDietPreference(Base):
    """
    Per-user diet preferences and computed calorie targets.
    One row per user (upsert on save).
    """
    __tablename__ = "user_diet_preferences"

    id                   = Column(Integer, primary_key=True, index=True)
    user_id              = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    # Personal metrics stored for re-calculation
    age                  = Column(Integer, default=25)
    gender               = Column(String(10), default="male")
    weight_kg            = Column(Float, default=70.0)
    height_cm            = Column(Float, default=170.0)
    activity_level       = Column(String(50), default="moderate")
    goal                 = Column(String(50), default="maintenance")  # fat_loss/muscle_gain/maintenance
    # Computed targets
    bmr                  = Column(Float, default=0.0)
    tdee                 = Column(Float, default=0.0)
    daily_calorie_target = Column(Float, default=2000.0)
    protein_target_g     = Column(Float, default=50.0)
    carbs_target_g       = Column(Float, default=250.0)
    fat_target_g         = Column(Float, default=65.0)
    water_target_ml      = Column(Float, default=2500.0)
    # Preferences
    region               = Column(String(100), default="general")
    diet_type            = Column(String(50),  default="non-vegetarian")
    allergies            = Column(JSON, default=list)
    meals_per_day        = Column(Integer, default=3)
    updated_at           = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="diet_preference")


class DailyMealLog(Base):
    """
    User's daily food diary — each row is one food item logged at one meal slot.
    """
    __tablename__ = "daily_meal_logs"

    id                  = Column(Integer, primary_key=True, index=True)
    user_id             = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    food_id             = Column(Integer, ForeignKey("nutrition_foods.id"), nullable=True)
    food_name           = Column(String(500), nullable=False)
    meal_type           = Column(String(50), nullable=False)   # breakfast/lunch/dinner/snack
    quantity_g          = Column(Float, default=100.0)
    calories_consumed   = Column(Float, default=0.0)
    protein_consumed_g  = Column(Float, default=0.0)
    carbs_consumed_g    = Column(Float, default=0.0)
    fat_consumed_g      = Column(Float, default=0.0)
    logged_at           = Column(DateTime, default=datetime.now)
    notes               = Column(Text, default="")

    food = relationship("NutritionFood", foreign_keys=[food_id])


class ImageAnalysisLog(Base):
    """
    Records each food image upload + AI prediction result.
    Confidence < 0.5 triggers a low-confidence flag on the frontend.
    """
    __tablename__ = "image_analysis_logs"

    id                  = Column(Integer, primary_key=True, index=True)
    user_id             = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    image_filename      = Column(String(500), default="")
    predicted_class     = Column(String(200), nullable=False)
    confidence          = Column(Float, default=0.0)
    portion_g           = Column(Float, default=150.0)
    estimated_calories  = Column(Float, default=0.0)
    estimated_protein_g = Column(Float, default=0.0)
    estimated_carbs_g   = Column(Float, default=0.0)
    estimated_fat_g     = Column(Float, default=0.0)
    analyzed_at         = Column(DateTime, default=datetime.utcnow)
