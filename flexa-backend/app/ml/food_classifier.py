"""
Module 3 – Food Image Classification Service
Architecture:
  - PyTorch ResNet-50 with frozen backbone + Dropout(0.3) + Linear(2048, 101)
  - Trained on Food-101 dataset (official 75 750 / 25 250 split)
  - If .pt model not found → falls back to keyword-based estimator
  - Class index decoded from food_class_map.json (saved during training)
  - Predicted class mapped to nutrition_foods table via fuzzy name match
  - Standard portion assumption: 150g per serving

Training script: flexa-backend/scripts/train_food_classifier.py
Model save path: flexa-backend/models/food_classifier.pt
Class map path : flexa-backend/models/food_class_map.json
"""
import os
import io
import json
import logging
from pathlib import Path
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# Paths
MODEL_DIR   = Path(__file__).resolve().parents[2] / "models"
MODEL_PATH  = MODEL_DIR / "food_classifier.pt"
MAP_PATH    = MODEL_DIR / "food_class_map.json"    # idx → class label (written by training)
CLASSES_TXT = Path(__file__).resolve().parents[3] / "Datasets" / "food-101" / "meta" / "classes.txt"

# Standard portion size assumption (grams) when no explicit weight is given
DEFAULT_PORTION_G = 150.0

# ─────────────────── Load Food-101 class labels ────────────────────────────

def load_food101_classes() -> list:
    """Read Food-101 class labels from classes.txt (101 entries, one per line)."""
    if CLASSES_TXT.exists():
        with open(CLASSES_TXT, "r") as f:
            return [line.strip().replace("_", " ") for line in f if line.strip()]
    # Minimal fallback subset
    return [
        "apple pie", "baby back ribs", "baklava", "beef carpaccio",
        "beef tartare", "beet salad", "beignets", "bibimbap",
        "bread pudding", "breakfast burrito", "bruschetta", "caesar salad",
        "cannoli", "caprese salad", "carrot cake", "ceviche", "cheesecake",
        "cheese plate", "chicken curry", "chicken quesadilla", "chicken wings",
        "chocolate cake", "chocolate mousse", "churros", "clam chowder",
        "club sandwich", "crab cakes", "creme brulee", "croque madame",
        "cup cakes", "deviled eggs", "donuts", "dumplings", "edamame",
        "eggs benedict", "escargots", "falafel", "filet mignon",
        "fish and chips", "foie gras", "french fries", "french onion soup",
        "french toast", "fried calamari", "fried rice", "frozen yogurt",
        "garlic bread", "gnocchi", "greek salad", "grilled cheese sandwich",
        "grilled salmon", "guacamole", "gyoza", "hamburger", "hot and sour soup",
        "hot dog", "huevos rancheros", "hummus", "ice cream", "lasagna",
        "lobster bisque", "lobster roll sandwich", "macaroni and cheese",
        "macarons", "miso soup", "mussels", "nachos", "omelette",
        "onion rings", "oysters", "pad thai", "paella", "pancakes",
        "panna cotta", "peking duck", "pho", "pizza", "pork chop",
        "poutine", "prime rib", "pulled pork sandwich", "ramen",
        "ravioli", "red velvet cake", "risotto", "samosa", "sashimi",
        "scallops", "seaweed salad", "shrimp and grits", "spaghetti bolognese",
        "spaghetti carbonara", "spring rolls", "steak", "strawberry shortcake",
        "sushi", "tacos", "takoyaki", "tiramisu", "tuna tartare", "waffles",
    ]


FOOD101_CLASSES = load_food101_classes()

# ───────────────────── Class map (idx → label) from training ────────────────
# Loaded lazily once the model is loaded; falls back to the ordered list.
_idx_to_class: dict = {}

def _load_class_map() -> dict:
    """Load the class map saved by the training script."""
    if MAP_PATH.exists():
        with open(MAP_PATH) as f:
            return json.load(f)
    # Fallback: build from sorted classes.txt (matches training's sorted() call)
    return {str(i): c for i, c in enumerate(sorted(FOOD101_CLASSES))}


# ───────────────────── Model loading (lazy singleton) ──────────────────────

_model = None
_transform = None
_model_loaded = False
_device = "cpu"


def _try_load_model():
    """
    Load ResNet-50 with the EXACT architecture used in train_food_classifier.py:
        model.fc = nn.Sequential(nn.Dropout(0.3), nn.Linear(2048, 101))
    Falls back silently if torch is not installed or model file is missing.
    """
    global _model, _transform, _model_loaded, _idx_to_class, _device
    if _model_loaded:
        return

    try:
        import torch
        import torch.nn as nn
        import torchvision.transforms as T
        from torchvision.models import resnet50, ResNet50_Weights

        _device = "cuda" if torch.cuda.is_available() else "cpu"

        if not MODEL_PATH.exists():
            logger.warning(
                "Food classifier model not found at %s. "
                "Run: cd flexa-backend && python scripts/train_food_classifier.py",
                MODEL_PATH,
            )
            _model_loaded = True
            return

        num_classes = 101   # Food-101

        # Build architecture EXACTLY as in train_food_classifier.py
        model = resnet50(weights=None)
        model.fc = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(model.fc.in_features, num_classes),
        )
        state = torch.load(MODEL_PATH, map_location=_device)
        model.load_state_dict(state)
        model.to(_device)
        model.eval()

        transform = T.Compose([
            T.Resize(256),
            T.CenterCrop(224),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

        _model      = model
        _transform  = transform
        _idx_to_class = _load_class_map()
        logger.info("✅ Food classifier loaded (%s) — device: %s", MODEL_PATH.name, _device)

    except ImportError:
        logger.warning("PyTorch not installed. Install: pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126")
    except Exception as e:
        logger.error("Failed to load food classifier: %s", e)

    _model_loaded = True


# ─────────────────── Inference ─────────────────────────────────────────────

def predict_from_image_bytes(image_bytes: bytes) -> Tuple[str, float]:
    """
    Run inference on raw JPEG/PNG image bytes.
    Returns (class_label, confidence_0_to_1).
    Falls back to ('unknown food', 0.0) if model is not loaded.
    """
    _try_load_model()

    if _model is None:
        return "unknown food", 0.0

    try:
        import torch
        from PIL import Image

        img    = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = _transform(img).unsqueeze(0).to(_device)  # type: ignore

        with torch.no_grad():
            logits = _model(tensor)
            probs  = torch.softmax(logits, dim=1)
            confidence, class_idx = probs.max(dim=1)

        idx   = str(class_idx.item())
        label = _idx_to_class.get(idx, FOOD101_CLASSES[int(idx)] if int(idx) < len(FOOD101_CLASSES) else "unknown food")
        # Food-101 labels use underscores — convert to spaces
        label = label.replace("_", " ")
        conf  = round(float(confidence.item()), 4)
        return label, conf

    except Exception as e:
        logger.error("Image inference error: %s", e)
        return "unknown food", 0.0


# ─────────────────── Nutrition mapping ─────────────────────────────────────

async def map_prediction_to_nutrition(
    predicted_class: str,
    db,  # AsyncSession
    portion_g: float = DEFAULT_PORTION_G,
) -> Optional[dict]:
    """
    Find the closest NutritionFood row matching the predicted class name.
    Uses case-insensitive LIKE match, then returns scaled macros.
    """
    from sqlalchemy import select, func
    from app.models.diet import NutritionFood

    try:
        # Try exact → partial match
        for pattern in [predicted_class, predicted_class.split()[0] if predicted_class else ""]:
            stmt = (
                select(NutritionFood)
                .where(NutritionFood.food_name.ilike(f"%{pattern}%"))
                .limit(1)
            )
            result = await db.execute(stmt)
            food = result.scalar_one_or_none()
            if food:
                scale = portion_g / 100.0
                return {
                    "food_id":    food.id,
                    "food_name":  food.food_name,
                    "calories":   round(food.calories   * scale, 1),
                    "protein_g":  round(food.protein_g  * scale, 1),
                    "carbs_g":    round(food.carbs_g    * scale, 1),
                    "fat_g":      round(food.fat_g      * scale, 1),
                }
    except Exception as e:
        logger.error("Nutrition mapping error: %s", e)

    return None
