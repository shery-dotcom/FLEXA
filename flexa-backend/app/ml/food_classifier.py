"""
Module 3 – Food Image Classification Service
Architecture:
    - Architecture is loaded from food_model_meta.json (mobile-friendly by default)
    - If .pt model not found → falls back to keyword-based estimator
    - Class index decoded from food_class_map.json (saved during training)
    - Predicted class mapped to nutrition_foods table via fuzzy name match
    - Standard portion assumption: 150g per serving

Training script: flexa-backend/scripts/train_food_classifier.py
Model save path: flexa-backend/models/food_classifier.pt
Class map path : flexa-backend/models/food_class_map.json
Model meta path: flexa-backend/models/food_model_meta.json
"""
import os
import io
import json
import logging
import re
from difflib import SequenceMatcher
from pathlib import Path
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# Paths
MODEL_DIR        = Path(__file__).resolve().parents[2] / "models"
MODEL_PATH       = MODEL_DIR / "food_classifier.pt"
MAP_PATH         = MODEL_DIR / "food_class_map.json"    # idx → class label (written by training)
META_PATH        = MODEL_DIR / "food_model_meta.json"
CLASSES_TXT      = Path(__file__).resolve().parents[3] / "Datasets" / "food-101" / "meta" / "classes.txt"
PAK_IMAGES_DIR   = Path(__file__).resolve().parents[3] / "Datasets" / "Pakistani Food Images"
VEG_IMAGES_DIR   = Path(__file__).resolve().parents[3] / "Datasets" / "Vegetables & Fruits"

# Standard portion size assumption (grams) when no explicit weight is given
DEFAULT_PORTION_G = 150.0

# ─────────────────── Load all class labels (combined datasets) ──────────────

def load_all_classes() -> list:
    """
    Build combined class list from all three dataset sources:
      1. Food-101 classes.txt
      2. Pakistani Food Images folder names
      3. Vegetables & Fruits folder names
    Returns sorted list matching the training script's _discover_all_classes().
    """
    all_classes: set = set()

    # Food-101
    if CLASSES_TXT.exists():
        with open(CLASSES_TXT, "r") as f:
            for line in f:
                name = line.strip().replace("_", " ").lower()
                if name:
                    all_classes.add(name)

    # Pakistani Food Images
    if PAK_IMAGES_DIR.exists():
        for folder in PAK_IMAGES_DIR.iterdir():
            if folder.is_dir():
                all_classes.add(folder.name.replace("_", " ").lower())

    # Vegetables & Fruits
    if VEG_IMAGES_DIR.exists():
        for folder in VEG_IMAGES_DIR.iterdir():
            if folder.is_dir():
                all_classes.add(folder.name.replace("_", " ").lower())

    # Fallback: Food-101 minimal subset
    if not all_classes:
        all_classes = {
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
        }

    return sorted(all_classes)


ALL_CLASSES = load_all_classes()

# ───────────────────── Class map (idx → label) from training ────────────────
# Loaded lazily once the model is loaded; falls back to the ordered list.
_idx_to_class: dict = {}

def _load_class_map() -> dict:
    """Load the class map saved by the training script."""
    if MAP_PATH.exists():
        with open(MAP_PATH) as f:
            return json.load(f)
    # Fallback: build from sorted combined classes (matches training's sorted() call)
    return {str(i): c for i, c in enumerate(ALL_CLASSES)}


# ───────────────────── Model loading (lazy singleton) ──────────────────────

_model = None
_transform = None
_model_loaded = False
_device = "cpu"
_loaded_signature = None
_model_meta = {
    "model_arch": "resnet50",
    "img_size": 224,
    "normalize_mean": [0.485, 0.456, 0.406],
    "normalize_std": [0.229, 0.224, 0.225],
}


def _load_model_meta() -> dict:
    if META_PATH.exists():
        try:
            with open(META_PATH, "r") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception as e:
            logger.warning("Could not read model meta at %s: %s", META_PATH, e)
    return {
        "model_arch": "resnet50",
        "img_size": 224,
        "normalize_mean": [0.485, 0.456, 0.406],
        "normalize_std": [0.229, 0.224, 0.225],
    }


def _build_model_by_arch(model_arch: str, num_classes: int):
    import torch.nn as nn
    from torchvision.models import (
        mobilenet_v3_large,
        resnet50,
    )

    arch = (model_arch or "resnet50").lower()
    if arch == "mobilenet_v3_large":
        model = mobilenet_v3_large(weights=None)
        in_features = model.classifier[-1].in_features
        model.classifier[-1] = nn.Linear(in_features, num_classes)
        return model

    if arch == "resnet50":
        model = resnet50(weights=None)
        model.fc = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(model.fc.in_features, num_classes),
        )
        return model

    raise ValueError(f"Unsupported model_arch '{model_arch}' in model metadata")


def _file_mtime(path: Path) -> float:
    try:
        return path.stat().st_mtime
    except Exception:
        return -1.0


def _current_signature() -> tuple:
    """Signature of model artifacts currently on disk for hot-reload checks."""
    return (
        MODEL_PATH.exists(),
        MAP_PATH.exists(),
        META_PATH.exists(),
        _file_mtime(MODEL_PATH),
        _file_mtime(MAP_PATH),
        _file_mtime(META_PATH),
    )


def _try_load_model():
    """
    Load ResNet-50 with the EXACT architecture used in train_food_classifier.py:
        model.fc = nn.Sequential(nn.Dropout(0.3), nn.Linear(2048, 101))
    Falls back silently if torch is not installed or model file is missing.
    """
    global _model, _transform, _model_loaded, _idx_to_class, _device, _model_meta, _loaded_signature
    current_sig = _current_signature()
    if _model_loaded and _loaded_signature == current_sig:
        return

    try:
        import torch
        import torchvision.transforms as T

        _device = "cuda" if torch.cuda.is_available() else "cpu"

        if not MODEL_PATH.exists():
            logger.warning(
                "Food classifier model not found at %s. "
                "Run: cd flexa-backend && python scripts/train_food_classifier.py",
                MODEL_PATH,
            )
            _model_loaded = True
            return

        # Determine num_classes dynamically from the saved class map
        class_map = _load_class_map()
        num_classes = len(class_map) if class_map else len(ALL_CLASSES)
        logger.info("Loading model with %d output classes", num_classes)

        _model_meta = _load_model_meta()
        model_arch = _model_meta.get("model_arch", "resnet50")
        img_size = int(_model_meta.get("img_size", 224))
        mean = _model_meta.get("normalize_mean", [0.485, 0.456, 0.406])
        std = _model_meta.get("normalize_std", [0.229, 0.224, 0.225])

        # Build architecture EXACTLY as saved during training
        model = _build_model_by_arch(model_arch=model_arch, num_classes=num_classes)
        state = torch.load(MODEL_PATH, map_location=_device)
        model.load_state_dict(state)
        model.to(_device)
        model.eval()

        transform = T.Compose([
            # Preserve full mobile frame instead of hard center-cropping portrait shots.
            T.Resize((img_size, img_size)),
            T.ToTensor(),
            T.Normalize(mean=mean, std=std),
        ])

        _model      = model
        _transform  = transform
        _idx_to_class = _load_class_map()
        _loaded_signature = current_sig
        logger.info(
            "Food classifier loaded (%s) arch=%s img=%s device=%s",
            MODEL_PATH.name,
            model_arch,
            img_size,
            _device,
        )

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
        label = _idx_to_class.get(idx, ALL_CLASSES[int(idx)] if int(idx) < len(ALL_CLASSES) else "unknown food")
        # Food-101 labels use underscores — convert to spaces
        label = label.replace("_", " ")
        conf  = round(float(confidence.item()), 4)
        return label, conf

    except Exception as e:
        logger.error("Image inference error: %s", e)
        return "unknown food", 0.0


def predict_top3_from_image_bytes(image_bytes: bytes) -> list:
    """
    Run inference and return the top-3 class predictions sorted by confidence.
    Returns a list of {"food_name": str, "confidence": float} dicts.
    Falls back to [{"food_name": "unknown food", "confidence": 0.0}] when the
    model is not loaded.
    """
    _try_load_model()

    if _model is None:
        return [{"food_name": "unknown food", "confidence": 0.0}]

    try:
        import torch
        from PIL import Image

        img    = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = _transform(img).unsqueeze(0).to(_device)  # type: ignore

        with torch.no_grad():
            logits = _model(tensor)
            probs  = torch.softmax(logits, dim=1)[0]   # shape: [num_classes]

        k = min(3, int(probs.shape[0]))
        top_conf, top_idx = torch.topk(probs, k=k, dim=0)

        results = []
        for conf_t, idx_t in zip(top_conf, top_idx):
            idx   = str(idx_t.item())
            label = _idx_to_class.get(
                idx,
                ALL_CLASSES[int(idx)] if int(idx) < len(ALL_CLASSES) else "unknown food",
            )
            label = label.replace("_", " ")
            results.append({"food_name": label, "confidence": round(float(conf_t.item()), 4)})

        return results

    except Exception as e:
        logger.error("Top-3 inference error: %s", e)
        return [{"food_name": "unknown food", "confidence": 0.0}]


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
    from sqlalchemy import select, or_
    from app.models.diet import NutritionFood

    def _norm(text: str) -> str:
        return re.sub(r"[^a-z0-9 ]+", " ", (text or "").lower()).strip()

    def _tokens(text: str) -> list:
        return [t for t in _norm(text).split() if len(t) > 2]

    def _score(pred: str, food: str) -> float:
        pred_n = _norm(pred)
        food_n = _norm(food)
        if not pred_n or not food_n:
            return 0.0

        seq = SequenceMatcher(None, pred_n, food_n).ratio()
        pred_t = set(_tokens(pred_n))
        food_t = set(_tokens(food_n))
        overlap = len(pred_t & food_t) / max(1, len(pred_t | food_t))
        contains_bonus = 0.15 if pred_n in food_n or food_n in pred_n else 0.0
        return (0.62 * seq) + (0.38 * overlap) + contains_bonus

    try:
        pred = (predicted_class or "").strip()
        if not pred:
            return None

        token_patterns = [NutritionFood.food_name.ilike(f"%{tok}%") for tok in _tokens(pred)]
        predicates = [NutritionFood.food_name.ilike(f"%{pred}%")]
        if token_patterns:
            predicates.extend(token_patterns)

        stmt = select(NutritionFood).where(or_(*predicates)).limit(80)
        result = await db.execute(stmt)
        candidates = result.scalars().all()
        if not candidates:
            return None

        best = max(candidates, key=lambda row: _score(pred, row.food_name or ""))
        if _score(pred, best.food_name or "") < 0.22:
            return None

        scale = portion_g / 100.0
        return {
            "food_id": best.id,
            "food_name": best.food_name,
            "calories": round(best.calories * scale, 1),
            "protein_g": round(best.protein_g * scale, 1),
            "carbs_g": round(best.carbs_g * scale, 1),
            "fat_g": round(best.fat_g * scale, 1),
        }
    except Exception as e:
        logger.error("Nutrition mapping error: %s", e)

    return None


def get_model_runtime_info() -> dict:
    """Expose runtime model metadata for mobile clients and diagnostics."""
    meta = _load_model_meta()
    return {
        "model_available": MODEL_PATH.exists(),
        "model_arch": meta.get("model_arch", "resnet50"),
        "img_size": int(meta.get("img_size", 224)),
        "normalize_mean": meta.get("normalize_mean", [0.485, 0.456, 0.406]),
        "normalize_std": meta.get("normalize_std", [0.229, 0.224, 0.225]),
        "class_map_available": MAP_PATH.exists(),
        "num_classes": len(_load_class_map()),
    }
