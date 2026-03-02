"""
Flexa – ML-Powered Meal Recommender
=====================================
Model: Content-Based Filtering via Cosine Similarity on a normalised
       5-dimensional macro feature space.

Feature vector per food (all values per 100 g of food):
    [calories, protein_g, carbs_g, fat_g, fiber_g]

At recommendation time:
    1. Hard-filter candidates by meal_type / diet_type / allergens
    2. Build a per-slot QUERY vector from the user's macro targets
    3. Transform both candidate matrix and query with a global StandardScaler
    4. Rank candidates by cosine similarity to the query
    5. Return top-N food indices (caller does region boosting + random tie-break)

Why cosine similarity over calorie-proximity:
    - Matches the FULL macro PROFILE (protein/carb/fat balance) not just
      total calories — critical for cutting vs bulking vs recomp
    - StandardScaler removes unit bias (kcal vs grams)
    - O(N) per query, runs entirely in-process with numpy

Singleton pattern: one fitted model shared across all requests.
The model re-fits automatically if the DB grows (call .invalidate()).
"""

import logging
from typing import List, Optional

import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

# ─── Feature column order ────────────────────────────────────────────────────
_FEATURES = ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g"]
_N_FEATURES = len(_FEATURES)

# ─── Pakistani sub-region aliases ────────────────────────────────────────────
# Foods from pakistani_meals.csv are typically tagged region="pakistani".
# When a user picks a sub-region (punjabi, sindhi, …) we also accept
# any food tagged "pakistani" so they see cultural food.
PAKISTANI_SUBREGIONS = frozenset({
    "punjabi", "sindhi", "balochi", "kashmiri", "pashtun", "karachi", "coastal",
})


class MealRecommenderML:
    """
    Scikit-learn content-based meal recommender.

    Usage
    -----
    recommender = MealRecommenderML()
    recommender.fit(food_dicts)          # list of dicts with nutrition keys
    indices = recommender.recommend(...)
    food    = recommender.get_food(idx)
    """

    def __init__(self) -> None:
        self._foods: List[dict] = []
        self._matrix: Optional[np.ndarray] = None   # (N, 5) scaled
        self._scaler: Optional[StandardScaler] = None
        self._fitted: bool = False

    # ── Public API ────────────────────────────────────────────────────────────

    def fit(self, foods: List[dict]) -> None:
        """
        Fit the StandardScaler on all available foods and cache the
        scaled feature matrix.  O(N) — typically called once per process.

        Parameters
        ----------
        foods : list of dicts
            Each dict must contain the keys in _FEATURES.
        """
        if not foods:
            logger.warning("MealRecommenderML.fit(): empty food list — skipped.")
            return

        self._foods = foods
        X = self._build_matrix(foods)
        self._scaler = StandardScaler()
        self._matrix = self._scaler.fit_transform(X)
        self._fitted = True
        logger.info(
            "MealRecommenderML fitted on %d foods  [features: %s]",
            len(foods),
            ", ".join(_FEATURES),
        )

    def recommend(
        self,
        target_calories: float,
        target_protein_g: float,
        target_carbs_g: float,
        target_fat_g: float,
        meal_type: str,
        diet_types: List[str],
        allergies: List[str],
        region: str,
        top_n: int = 10,
        region_boost: float = 0.40,
    ) -> List[int]:
        """
        Return food indices ranked by cosine similarity to the target macros,
        using a two-pass regional strategy:

        Pass 1 — Regional pool:
            Candidates filtered to region == user_region (or cuisine match).
            If >= 3 pass hard filters, rank these by cosine similarity and
            return.  This guarantees culturally relevant results when the DB
            has sufficient regional coverage.

        Pass 2 — Full pool with boost:
            Fewer than 3 regional candidates found (sparse region in DB).
            Fall back to the entire corpus, apply cosine similarity over all
            valid candidates, then add +0.40 similarity bonus to any food
            whose region/cuisine matches so they still surface near the top.

        Parameters
        ----------
        target_* : per-slot macro goals
        meal_type : 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'any'
        diet_types: list of acceptable diet labels
        allergies : list of allergen strings to exclude
        region    : user's preferred cuisine region
        top_n     : how many ranked candidates to return
        region_boost : similarity bonus applied in Pass-2 fallback (0-1)

        Returns
        -------
        list of int -- indices into self._foods, best first
        """
        if not self._fitted or self._matrix is None:
            return []

        compatible_diets = self._compatible_diets(diet_types)

        # ── Build & scale query vector ────────────────────────────────────────
        factor = 1.5
        q_raw = np.array(
            [[
                target_calories  / factor,
                target_protein_g / factor,
                target_carbs_g   / factor,
                target_fat_g     / factor,
                0.0,
            ]],
            dtype=np.float64,
        )
        q_scaled = self._scaler.transform(q_raw)   # shape (1, 5)

        # ── Pass 1: regional-only candidates ─────────────────────────────────
        region_lower = (region or "").lower().strip()
        # For Pakistani sub-regions also match foods tagged "pakistani"
        alt_regions: set = {"pakistani"} if region_lower in PAKISTANI_SUBREGIONS else set()

        if region_lower and region_lower != "general":
            regional_idx = [
                i for i, f in enumerate(self._foods)
                if self._passes_hard_filter(f, meal_type, compatible_diets, allergies)
                and self._region_matches(f, region_lower, alt_regions)
            ]

            if len(regional_idx) >= 3:
                # Enough regional foods — rank by cosine sim within that pool
                reg_matrix = self._matrix[regional_idx]
                sims = cosine_similarity(q_scaled, reg_matrix)[0]
                ranked_local = np.argsort(sims)[::-1][:top_n]
                return [regional_idx[i] for i in ranked_local]

        # ── Pass 2: full pool with region boost ───────────────────────────────
        candidate_idx = [
            i for i, f in enumerate(self._foods)
            if self._passes_hard_filter(f, meal_type, compatible_diets, allergies)
        ]

        # Relax meal_type to 'any' when no specific match found
        if not candidate_idx:
            candidate_idx = [
                i for i, f in enumerate(self._foods)
                if self._passes_hard_filter(f, "any", compatible_diets, allergies)
            ]

        if not candidate_idx:
            return []

        cand_matrix = self._matrix[candidate_idx]
        sims = cosine_similarity(q_scaled, cand_matrix)[0]

        # Apply soft boost for region / cuisine match
        if region_lower and region_lower != "general":
            for local_i, global_i in enumerate(candidate_idx):
                f = self._foods[global_i]
                if self._region_matches(f, region_lower, alt_regions):
                    sims[local_i] = min(1.0, sims[local_i] + region_boost)

        ranked_local = np.argsort(sims)[::-1][:top_n]
        return [candidate_idx[i] for i in ranked_local]

    def get_food(self, idx: int) -> dict:
        """Return the raw food dict at position idx."""
        return self._foods[idx]

    def invalidate(self) -> None:
        """Force re-fit on next call (e.g. after DB reseed)."""
        self._fitted = False
        self._foods = []
        self._matrix = None
        self._scaler = None
        logger.info("MealRecommenderML invalidated — will re-fit on next request.")

    @property
    def is_fitted(self) -> bool:
        return self._fitted

    @property
    def food_count(self) -> int:
        return len(self._foods)

    # ── Private helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _region_matches(food: dict, region: str, alt_regions: set) -> bool:
        """True if the food's region or cuisine matches the requested region or any alt."""
        combined = (
            (food.get("region") or "").lower() + " " +
            (food.get("cuisine") or "").lower()
        )
        if region in combined:
            return True
        return any(alt in combined for alt in alt_regions)

    @staticmethod
    def _build_matrix(foods: List[dict]) -> np.ndarray:
        X = np.array(
            [[
                float(f.get("calories",  0) or 0),
                float(f.get("protein_g", 0) or 0),
                float(f.get("carbs_g",   0) or 0),
                float(f.get("fat_g",     0) or 0),
                float(f.get("fiber_g",   0) or 0),
            ] for f in foods],
            dtype=np.float64,
        )
        return np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)

    @staticmethod
    def _compatible_diets(diet_types: List[str]) -> set:
        compatible = set(diet_types) | {"any"}
        if "non-vegetarian" in diet_types:
            compatible.update({"vegetarian", "vegan"})
        elif "vegetarian" in diet_types:
            compatible.add("vegan")
        return compatible

    @staticmethod
    def _passes_hard_filter(
        food: dict,
        meal_type: str,
        compatible_diets: set,
        allergies: List[str],
    ) -> bool:
        # meal_type
        food_mt = (food.get("meal_type") or "any").lower()
        if food_mt not in (meal_type.lower(), "any"):
            return False

        # diet_type
        food_dt = (food.get("diet_type") or "any").lower()
        if food_dt not in compatible_diets:
            return False

        # allergens
        if allergies:
            al_str = (food.get("allergens") or "").lower()
            if any(a.strip().lower() in al_str for a in allergies if a.strip()):
                return False

        # must have positive calories
        if not (food.get("calories") or 0):
            return False

        return True


# ─────────────────────────────────────────────────────────────────────────────
# Module-level singleton — shared across all FastAPI workers in the same process
# ─────────────────────────────────────────────────────────────────────────────
_recommender = MealRecommenderML()


def get_recommender() -> MealRecommenderML:
    """Return the shared MealRecommenderML singleton."""
    return _recommender
