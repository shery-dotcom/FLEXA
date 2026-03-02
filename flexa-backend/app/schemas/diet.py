"""
Module 3 – Pydantic schemas for Diet & Calorie Planner API
"""
from pydantic import BaseModel, Field, field_validator, validator
from typing import List, Optional, Dict, Any
from datetime import datetime


# ─────────────────────────── Calorie Calculator ────────────────────────────

class CalorieCalculatorRequest(BaseModel):
    age: int = Field(..., ge=10, le=100, description="Age in years")
    gender: str = Field(..., pattern="^(male|female)$")
    weight_kg: float = Field(..., ge=20, le=300, description="Weight in kg")
    height_cm: float = Field(..., ge=100, le=250, description="Height in cm")
    activity_level: str = Field(
        ...,
        description="sedentary | lightly_active | moderately_active | very_active | extremely_active"
    )
    goal: str = Field(
        ...,
        description="fat_loss | muscle_gain | maintenance"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "age": 25, "gender": "male", "weight_kg": 75,
                "height_cm": 175, "activity_level": "moderately_active",
                "goal": "fat_loss"
            }
        }


class CalorieCalculatorResponse(BaseModel):
    bmr: float
    tdee: float
    calorie_target: float
    protein_g: float
    carbs_g: float
    fat_g: float
    water_ml: float
    goal: str
    activity_level: str
    summary: str


# ───────────────────────── Diet Plan Generation ────────────────────────────

class DietPlanRequest(BaseModel):
    calorie_target: float = Field(..., ge=800, le=6000)
    protein_g: float
    carbs_g: float
    fat_g: float
    region: str = Field(default="general", description="punjabi|sindhi|balochi|kashmiri|general")
    diet_type: List[str] = Field(default=["non-vegetarian"], description="list of: non-vegetarian|vegetarian|vegan|keto")
    allergies: List[str] = Field(default=[], description="e.g. ['dairy','gluten','nuts']")
    meals_per_day: int = Field(default=3, ge=2, le=6)


class MealSuggestion(BaseModel):
    id: int
    food_name: str
    meal_type: str
    quantity_g: float
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    cuisine: str
    ingredients: str
    allergens: str


class DietPlanResponse(BaseModel):
    calorie_target: float
    breakfast: List[MealSuggestion]
    lunch: List[MealSuggestion]
    dinner: List[MealSuggestion]
    snacks: List[MealSuggestion]
    total_calories: float
    total_protein_g: float
    total_carbs_g: float
    total_fat_g: float
    water_ml: float
    tips: List[str]


# ─────────────────────────── Meal Log ──────────────────────────────────────

class MealLogCreate(BaseModel):
    food_id: Optional[int] = None
    food_name: str
    meal_type: str = Field(..., description="breakfast|lunch|dinner|snack")
    quantity_g: float = Field(default=100.0, ge=1)
    notes: str = ""
    # Optional pre-computed macros (used when food_id is absent/0, e.g. plan items)
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None


class MealLogResponse(BaseModel):
    id: int
    food_name: str
    meal_type: str
    quantity_g: float
    calories_consumed: float = 0.0
    protein_consumed_g: float = 0.0
    carbs_consumed_g: float = 0.0
    fat_consumed_g: float = 0.0
    logged_at: datetime
    notes: Optional[str] = ""

    class Config:
        from_attributes = True


class DailySummaryResponse(BaseModel):
    date: str
    calorie_target: float
    calories_consumed: float
    protein_target_g: float
    protein_consumed_g: float
    carbs_target_g: float
    carbs_consumed_g: float
    fat_target_g: float
    fat_consumed_g: float
    water_target_ml: float
    meals: List[MealLogResponse]
    calorie_remaining: float
    on_track: bool


# ─────────────────────────── Food Search ───────────────────────────────────

class FoodSearchResult(BaseModel):
    id: int
    food_name: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    serving_size_g: float
    meal_type: str
    cuisine: str
    diet_type: str
    allergens: str
    region: str

    class Config:
        from_attributes = True


# ─────────────────────────── User Preferences ──────────────────────────────

class DietPreferenceUpdate(BaseModel):
    region: Optional[str] = None
    diet_type: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    meals_per_day: Optional[int] = None


class DietPreferenceResponse(BaseModel):
    age: int
    gender: str
    weight_kg: float
    height_cm: float
    activity_level: str
    goal: str
    bmr: float
    tdee: float
    daily_calorie_target: float
    protein_target_g: float
    carbs_target_g: float
    fat_target_g: float
    water_target_ml: float
    region: str
    diet_type: List[str]
    allergies: List[str]
    meals_per_day: int

    @field_validator("diet_type", mode="before")
    @classmethod
    def parse_diet_type(cls, v):
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            return [t.strip() for t in v.split(",") if t.strip()]
        return ["non-vegetarian"]

    class Config:
        from_attributes = True


# ─────────────────────────── Image Analysis ────────────────────────────────

class TopPrediction(BaseModel):
    """One entry in the top-3 alternatives returned on low-confidence images."""
    food_name: str
    confidence: float


class ImageAnalysisResponse(BaseModel):
    predicted_class: str
    confidence: float
    portion_g: float
    estimated_calories: float
    estimated_protein_g: float
    estimated_carbs_g: float
    estimated_fat_g: float
    low_confidence: bool
    matched_food: Optional[FoodSearchResult] = None
    message: str
    # Populated when confidence < CONFIDENCE_THRESHOLD (0.60)
    top_predictions: List[TopPrediction] = []
    requires_confirmation: bool = False
