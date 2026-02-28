"""
Flexa â€” Module 4: Workout Planner & Scheduler
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ML Classification Pipeline: Workout Split Recommender
======================================================
Inputs  : Age, Gender, Training Frequency, Experience Level, Primary Goal
Target  : Workout Split (Full Body / PPL / PPL x2 / Upper-Lower / Bro Split)

Pipeline steps
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 1. Load & clean dataset  (drop irrelevant columns, normalise values)
 2. Encode categoricals   (ordinal + one-hot + interaction features â†’ 18-D)
 3. Stratified 80/20 split
 4. Class imbalance       (SMOTETomek â€” oversample minority, remove Tomek links)
 5. Baseline models       (Random Forest, XGBoost, Extra Trees â€” raw train set)
 6. SMOTE pipelines       (same models, SMOTE applied inside each CV fold)
 7. Hyperparameter tuning (RandomizedSearchCV for RF & XGBoost on SMOTE data)
 8. Soft Voting Ensemble  (top 3 models)
 9. Full evaluation       (Accuracy, Macro-F1, Weighted-F1, Confusion Matrix)
10. Feature importance    (top-10 table + JSON export)
11. Save artefacts        (model.pkl, label_encoder.pkl, meta.json, importance.json)

Integration
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  from app.ml.workout_ml_predictor import predict_split_with_proba
  result = predict_split_with_proba(goal_type, activity_level, gender, age)
  # â†’ {"split": "Bro Split", "probas": {"Bro Split": 0.79, ...}}
"""
import os, json, pickle, warnings
warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np
from sklearn.model_selection import (
    train_test_split, StratifiedKFold, RandomizedSearchCV, cross_val_score
)
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import (
    classification_report, accuracy_score,
    f1_score, confusion_matrix
)
from sklearn.ensemble import (
    RandomForestClassifier, ExtraTreesClassifier, VotingClassifier
)
from sklearn.svm import SVC
from sklearn.pipeline import Pipeline as SkPipeline
from xgboost import XGBClassifier
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
from imblearn.combine import SMOTETomek

# â”€â”€ Paths â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(
    "d:\\", "CUI'26", "FYP", "Flexa", "flexa-frontend", "WorkoutPlanning_Dataset.xlsx"
)
MODEL_DIR    = BASE_DIR
MODEL_PATH   = os.path.join(MODEL_DIR, "workout_model.pkl")
ENCODER_PATH = os.path.join(MODEL_DIR, "workout_label_encoder.pkl")
IMP_PATH     = os.path.join(MODEL_DIR, "workout_feature_importance.json")

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# STEP 1 â€” LOAD & CLEAN
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
print("â”"*60)
print("STEP 1 â€” Load & Clean")
print("â”"*60)
print("Loading dataset...")
df = pd.read_excel(DATASET_PATH)

# Drop irrelevant columns: Timestamp (col 0) and Name (col 1)
# The dataset has positional headers from Google Forms
RENAME = {
    df.columns[1]: "name",
    df.columns[2]: "age",
    df.columns[3]: "gender",
    df.columns[4]: "frequency",
    df.columns[5]: "experience",
    df.columns[6]: "goal",
    df.columns[7]: "split",   # â† TARGET
}
df = df.rename(columns=RENAME).drop(columns=["Timestamp", "name"], errors="ignore")

# Drop rows missing any key field
df = df.dropna(subset=["frequency", "experience", "goal", "split"])
print(f"Dataset after cleaning: {len(df)} rows Ã— {len(df.columns)} columns")

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# STEP 2 â€” NORMALISE & ENCODE
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
print("\n" + "â”"*60)
print("STEP 2 â€” Normalise & Encode")
print("â”"*60)

# â”€â”€ Normalise raw text values â†’ canonical strings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def norm_freq(v):
    """Extract leading digit from frequency strings like '3 days/week'."""
    v = str(v).strip()
    for d in ["2", "3", "4", "5", "6"]:
        if v.startswith(d):
            return int(d)
    return 3  # fallback to 3 days

def norm_exp(v):
    """Map experience level text to Beginner / Intermediate / Advanced."""
    v = str(v).lower()
    if "begin" in v: return "Beginner"
    if "inter" in v: return "Intermediate"
    return "Advanced"

def norm_goal(v):
    """Map goal text to Cutting / Maintaining / Bulking."""
    v = str(v).lower()
    if "bulk" in v: return "Bulking"
    if "cut"  in v: return "Cutting"
    return "Maintaining"   # covers recomp / maintaining

def norm_split(v):
    """Normalise workout split label from full Google Form text."""
    v = str(v).strip()
    if "Full Body"        in v: return "Full Body"
    if "PPL x2" in v or "6 days" in v: return "PPL x2"
    if "Push/Pull/Legs"   in v: return "PPL"
    if "Upper/Lower"      in v: return "Upper/Lower"
    if "Bro Split"        in v: return "Bro Split"
    return v

df["frequency"]  = df["frequency"].apply(norm_freq)
df["experience"] = df["experience"].apply(norm_exp)
df["goal"]       = df["goal"].apply(norm_goal)
df["gender"]     = df["gender"].apply(
    lambda v: "Male" if str(v).lower().startswith("m") else "Female"
)
df["split"] = df["split"].apply(norm_split)
df["age"]   = pd.to_numeric(df["age"], errors="coerce").fillna(df["age"].median())

print("\nClass distribution (Target â€” Workout Split):")
print(df["split"].value_counts().to_string())

# â”€â”€ Ordinal encoding maps â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# NOTE: these exact maps must match workout_ml_predictor.py
exp_map    = {"Beginner": 0, "Intermediate": 1, "Advanced": 2}
goal_map   = {"Cutting": 0, "Maintaining": 1, "Bulking": 2}
gender_map = {"Female": 0, "Male": 1}

df["exp_enc"]    = df["experience"].map(exp_map)
df["goal_enc"]   = df["goal"].map(goal_map)
df["gender_enc"] = df["gender"].map(gender_map)

# â”€â”€ Feature Engineering: 5 base + 13 derived = 18 total â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
print("\nBuilding 18-feature matrix...")
freq     = df["frequency"].values.astype(float)
exp_e    = df["exp_enc"].values.astype(float)
goal_e   = df["goal_enc"].values.astype(float)
age      = df["age"].values.astype(float)
gender_e = df["gender_enc"].values.astype(float)

# Interactions â€” capture combined signals
freq_x_exp  = freq * exp_e     # high freq + advanced â†’ PPL x2 / Bro
freq_x_goal = freq * goal_e    # high freq + bulking  â†’ Bro / PPL x2
exp_x_goal  = exp_e * goal_e   # advanced + cutting   â†’ Bro / PPL

# Non-linear transforms
freq_sq  = freq ** 2
freq_bin = np.where(freq <= 3, 0, np.where(freq <= 5, 1, 2)).astype(float)
age_grp  = np.where(age <= 25, 0, np.where(age <= 40, 1, 2)).astype(float)

# One-hot encoding (avoids ordinal assumption for tree models)
goal_cut  = (goal_e == 0).astype(float)
goal_main = (goal_e == 1).astype(float)
goal_bulk = (goal_e == 2).astype(float)
exp_beg   = (exp_e == 0).astype(float)
exp_inter = (exp_e == 1).astype(float)
exp_adv   = (exp_e == 2).astype(float)

# Composite effort score
effort = freq * (exp_e + 1)

X = np.column_stack([
    freq, exp_e, goal_e, gender_e, age,        # base (5)
    freq_x_exp, freq_x_goal, exp_x_goal,       # interactions (3)
    freq_sq, freq_bin, age_grp,                # transforms (3)
    goal_cut, goal_main, goal_bulk,            # goal one-hot (3)
    exp_beg, exp_inter, exp_adv,               # exp one-hot (3)
    effort,                                    # effort (1)
])

FEATURE_NAMES = [
    "frequency", "exp_enc", "goal_enc", "gender_enc", "age",
    "freq_x_exp", "freq_x_goal", "exp_x_goal",
    "freq_sq", "freq_bin", "age_grp",
    "goal_cut", "goal_main", "goal_bulk",
    "exp_beg", "exp_inter", "exp_adv",
    "effort",
]
print(f"Feature matrix: {X.shape[0]} rows Ã— {X.shape[1]} features")

# Encode target labels
label_enc = LabelEncoder()
y = label_enc.fit_transform(df["split"])
print("Classes:", list(label_enc.classes_))

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# STEP 3 â€” STRATIFIED TRAIN / TEST SPLIT  (80/20)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
print("\n" + "â”"*60)
print("STEP 3 â€” Stratified 80/20 Train/Test Split")
print("â”"*60)
# stratify=y ensures each class is proportionally represented in both sets
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
print(f"Train set : {len(X_train)} samples")
print(f"Test  set : {len(X_test)} samples")

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# STEP 4 â€” CLASS IMBALANCE: SMOTETomek
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
print("\n" + "â”"*60)
print("STEP 4 â€” SMOTETomek (oversample minority + clean Tomek links)")
print("â”"*60)
# SMOTETomek = SMOTE (generate synthetic minority samples) +
#              Tomek links removal (delete ambiguous border samples)
# Applied ONLY to the training set â€” test set stays real/unmodified
smote_tomek = SMOTETomek(random_state=42)
X_train_res, y_train_res = smote_tomek.fit_resample(X_train, y_train)
print(f"Before: {len(X_train)} samples â†’ After: {len(X_train_res)} samples")
unique, counts = np.unique(y_train_res, return_counts=True)
for cls_idx, cnt in zip(unique, counts):
    print(f"  {label_enc.classes_[cls_idx]:<20} {cnt} samples")

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# EVALUATION HELPER
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
def evaluate(name, model, X_tr, y_tr, X_te, y_te, cv_obj, classes, fit=True):
    """
    Train (optional), cross-validate, and evaluate a model.
    Prints: Accuracy, Macro-F1, Weighted-F1, per-class report, Confusion Matrix.
    Returns result dict.
    """
    cv_scores = cross_val_score(model, X_tr, y_tr, cv=cv_obj,
                                scoring="accuracy", n_jobs=-1)
    if fit:
        model.fit(X_tr, y_te if False else y_tr)
    y_pred   = model.predict(X_te)
    acc      = accuracy_score(y_te, y_pred)
    f1_mac   = f1_score(y_te, y_pred, average="macro",    zero_division=0)
    f1_wt    = f1_score(y_te, y_pred, average="weighted", zero_division=0)
    cm       = confusion_matrix(y_te, y_pred)

    print(f"\n{'â”€'*60}")
    print(f"  {name}")
    print(f"{'â”€'*60}")
    print(f"  CV  Accuracy : {cv_scores.mean()*100:.1f}% Â± {cv_scores.std()*100:.1f}%")
    print(f"  Test Accuracy: {acc*100:.1f}%")
    print(f"  Macro  F1    : {f1_mac*100:.1f}%")
    print(f"  Weighted F1  : {f1_wt*100:.1f}%")
    print("\n  Per-class Report:")
    print(classification_report(y_te, y_pred, target_names=classes, zero_division=0))
    print("  Confusion Matrix (rows=actual, cols=predicted):")
    header = "  " + "".join(f"{c[:8]:>10}" for c in classes)
    print(header)
    for i, row in enumerate(cm):
        print(f"  {classes[i][:8]:<10}" + "".join(f"{v:>10}" for v in row))

    return {
        "cv_mean": cv_scores.mean(), "cv_std": cv_scores.std(),
        "test_acc": acc, "f1_macro": f1_mac, "f1_weighted": f1_wt,
        "model": model,
    }

cv10 = StratifiedKFold(n_splits=10, shuffle=True, random_state=42)
classes = list(label_enc.classes_)
results = {}

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# STEP 5 â€” BASELINE MODELS (raw training set, no SMOTE)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
print("\n" + "â”"*60)
print("STEP 5 â€” Baseline Models (raw train set, no SMOTE)")
print("â”"*60)

baselines = {
    "Random Forest (baseline)": RandomForestClassifier(
        n_estimators=500, max_depth=8, class_weight="balanced",
        random_state=42, n_jobs=-1,
    ),
    "XGBoost (baseline)": XGBClassifier(
        n_estimators=400, max_depth=5, learning_rate=0.08,
        subsample=0.85, colsample_bytree=0.85, min_child_weight=2,
        gamma=0.1, reg_alpha=0.05, reg_lambda=1.0,
        eval_metric="mlogloss", random_state=42, verbosity=0,
    ),
    "Extra Trees (baseline)": ExtraTreesClassifier(
        n_estimators=600, max_depth=None, min_samples_split=3,
        min_samples_leaf=1, max_features="sqrt",
        class_weight="balanced", random_state=42, n_jobs=-1,
    ),
}
for name, clf in baselines.items():
    clf.fit(X_train, y_train)
    results[name] = evaluate(name, clf, X_train, y_train,
                             X_test, y_test, cv10, classes, fit=False)

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# STEP 6 â€” SMOTE PIPELINES (SMOTE inside each CV fold â€” no data leakage)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
print("\n" + "â”"*60)
print("STEP 6 â€” SMOTE Pipelines (SMOTE inside each CV fold)")
print("â”"*60)
# Using imblearn Pipeline ensures SMOTE is only applied to training folds,
# preventing data leakage during cross-validation.

smote_pipelines = {
    "XGBoost + SMOTE": ImbPipeline([
        ("smote", SMOTE(random_state=42, k_neighbors=5)),
        ("clf", XGBClassifier(
            n_estimators=400, max_depth=5, learning_rate=0.08,
            subsample=0.85, colsample_bytree=0.85, min_child_weight=2,
            gamma=0.1, reg_alpha=0.05, reg_lambda=1.0,
            eval_metric="mlogloss", random_state=42, verbosity=0,
        )),
    ]),
    "XGBoost + SMOTETomek": ImbPipeline([
        ("smote", SMOTETomek(random_state=42)),
        ("clf", XGBClassifier(
            n_estimators=500, max_depth=5, learning_rate=0.06,
            subsample=0.85, colsample_bytree=0.85, min_child_weight=2,
            gamma=0.05, reg_alpha=0.1, reg_lambda=1.0,
            eval_metric="mlogloss", random_state=42, verbosity=0,
        )),
    ]),
    "Extra Trees + SMOTE": ImbPipeline([
        ("smote", SMOTE(random_state=42, k_neighbors=5)),
        ("clf", ExtraTreesClassifier(
            n_estimators=600, max_depth=None, min_samples_split=3,
            min_samples_leaf=1, max_features="sqrt",
            class_weight="balanced", random_state=42, n_jobs=-1,
        )),
    ]),
    "SVM (RBF) + SMOTE": ImbPipeline([
        ("smote", SMOTE(random_state=42, k_neighbors=5)),
        ("scaler", StandardScaler()),
        ("clf", SVC(kernel="rbf", C=10, gamma="scale",
                    probability=True, class_weight="balanced", random_state=42)),
    ]),
}
for name, pipeline in smote_pipelines.items():
    pipeline.fit(X_train_res, y_train_res)
    results[name] = evaluate(name, pipeline, X_train_res, y_train_res,
                             X_test, y_test, cv10, classes, fit=False)

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# STEP 7 â€” HYPERPARAMETER TUNING  (RandomizedSearchCV)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
print("\n" + "â”"*60)
print("STEP 7 â€” Hyperparameter Tuning (RandomizedSearchCV on SMOTE data)")
print("â”"*60)

# â”€â”€ 7a. Random Forest tuning â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
print("\n[7a] Tuning Random Forest (40 iterations) ...")
rf_param_grid = {
    "n_estimators":      [300, 500, 700, 1000],
    "max_depth":         [None, 6, 8, 10, 12],
    "min_samples_split": [2, 3, 4, 5],
    "min_samples_leaf":  [1, 2, 3],
    "max_features":      ["sqrt", "log2"],
    "class_weight":      ["balanced", "balanced_subsample"],
}
rf_search = RandomizedSearchCV(
    RandomForestClassifier(random_state=42, n_jobs=-1),
    rf_param_grid,
    n_iter=40,
    cv=StratifiedKFold(n_splits=10, shuffle=True, random_state=42),
    scoring="accuracy", random_state=42, n_jobs=-1, refit=True,
)
rf_search.fit(X_train_res, y_train_res)
rf_tuned = rf_search.best_estimator_
print(f"  Best params: {rf_search.best_params_}")
results["Tuned RF + SMOTE"] = evaluate(
    "Tuned Random Forest + SMOTE", rf_tuned,
    X_train_res, y_train_res, X_test, y_test, cv10, classes, fit=False,
)

# â”€â”€ 7b. XGBoost tuning â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
print("\n[7b] Tuning XGBoost (60 iterations) ...")
xgb_param_grid = {
    "n_estimators":     [300, 500, 700, 1000],
    "max_depth":        [3, 4, 5, 6],
    "learning_rate":    [0.01, 0.03, 0.05, 0.08, 0.1],
    "subsample":        [0.7, 0.8, 0.85, 0.9],
    "colsample_bytree": [0.7, 0.8, 0.85, 0.9],
    "min_child_weight": [1, 2, 3, 4],
    "gamma":            [0, 0.05, 0.1, 0.2, 0.3],
    "reg_alpha":        [0, 0.05, 0.1, 0.2],
    "reg_lambda":       [0.5, 1.0, 1.5, 2.0],
}
xgb_search = RandomizedSearchCV(
    XGBClassifier(eval_metric="mlogloss", random_state=42, verbosity=0),
    xgb_param_grid,
    n_iter=60,
    cv=StratifiedKFold(n_splits=10, shuffle=True, random_state=42),
    scoring="accuracy", random_state=42, n_jobs=-1, refit=True,
)
xgb_search.fit(X_train_res, y_train_res)
xgb_tuned = xgb_search.best_estimator_
print(f"  Best params: {xgb_search.best_params_}")
results["Tuned XGBoost + SMOTE"] = evaluate(
    "Tuned XGBoost + SMOTE", xgb_tuned,
    X_train_res, y_train_res, X_test, y_test, cv10, classes, fit=False,
)

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# STEP 8 â€” SOFT VOTING ENSEMBLE
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
print("\n" + "â”"*60)
print("STEP 8 â€” Soft Voting Ensemble (Tuned XGBoost + Tuned RF + SVM)")
print("â”"*60)
# Combine the best individual models â€” each casts a probability vote
ensemble = VotingClassifier(
    estimators=[
        ("xgb", XGBClassifier(
            **xgb_search.best_params_,
            eval_metric="mlogloss", random_state=42, verbosity=0)),
        ("rf",  RandomForestClassifier(
            **rf_search.best_params_,
            random_state=42, n_jobs=-1)),
        ("svm", SkPipeline([
            ("scaler", StandardScaler()),
            ("clf", SVC(kernel="rbf", C=10, gamma="scale",
                        probability=True, class_weight="balanced", random_state=42)),
        ])),
    ],
    voting="soft",
)
ensemble.fit(X_train_res, y_train_res)
results["Soft Ensemble + SMOTE"] = evaluate(
    "Soft Ensemble + SMOTE", ensemble,
    X_train_res, y_train_res, X_test, y_test,
    StratifiedKFold(n_splits=5, shuffle=True, random_state=42),
    classes, fit=False,
)

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# STEP 9 â€” FINAL RESULTS TABLE
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
print("\n" + "â”"*60)
print("STEP 9 â€” Final Results Summary")
print("â”"*60)
header = f"  {'Model':<35} {'CV Acc':>8} {'Test Acc':>9} {'Macro F1':>9} {'Wtd F1':>8}"
print(header)
print("  " + "â”€" * (len(header) - 2))
for name, r in sorted(results.items(), key=lambda x: x[1]["cv_mean"], reverse=True):
    print(
        f"  {name:<35}"
        f" {r['cv_mean']*100:>7.1f}%"
        f" {r['test_acc']*100:>8.1f}%"
        f" {r['f1_macro']*100:>8.1f}%"
        f" {r['f1_weighted']*100:>7.1f}%"
    )

best_name  = max(results, key=lambda k: results[k]["cv_mean"])
best       = results[best_name]
best_model = best["model"]
print(f"\n  â˜… WINNER: {best_name}")
print(f"    CV Accuracy  : {best['cv_mean']*100:.1f}%")
print(f"    Test Accuracy: {best['test_acc']*100:.1f}%")
print(f"    Macro F1     : {best['f1_macro']*100:.1f}%")
print(f"    Weighted F1  : {best['f1_weighted']*100:.1f}%")

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# STEP 10 â€” FEATURE IMPORTANCE
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
print("\n" + "â”"*60)
print("STEP 10 â€” Feature Importance")
print("â”"*60)

def extract_importances(model, names):
    """Extract feature_importances_ from a plain model or pipeline."""
    if hasattr(model, "feature_importances_"):
        return model.feature_importances_
    if hasattr(model, "named_steps"):
        for step in model.named_steps.values():
            if hasattr(step, "feature_importances_"):
                return step.feature_importances_
    if hasattr(model, "estimators_"):
        # VotingClassifier â€” average importances of tree-based members
        imps = []
        for est in model.estimators_:
            fi = extract_importances(est, names)
            if fi is not None:
                imps.append(fi)
        if imps:
            return np.mean(imps, axis=0)
    return None

# Show feature importance for tuned RF and tuned XGBoost
importance_export = {}
for label, mdl in [("Tuned RF + SMOTE", rf_tuned), ("Tuned XGBoost + SMOTE", xgb_tuned)]:
    fi = extract_importances(mdl, FEATURE_NAMES)
    if fi is None:
        continue
    ranked = sorted(zip(FEATURE_NAMES, fi), key=lambda x: x[1], reverse=True)
    print(f"\n  {label} â€” Top 10 Features:")
    print(f"  {'Feature':<20} {'Importance':>10}")
    print("  " + "â”€" * 32)
    for feat, imp in ranked[:10]:
        bar = "â–ˆ" * int(imp * 60)
        print(f"  {feat:<20} {imp:>10.4f}  {bar}")
    importance_export[label] = {f: float(round(i, 6)) for f, i in ranked}

# Best model importance (if available)
best_fi = extract_importances(best_model, FEATURE_NAMES)
if best_fi is not None:
    ranked_best = sorted(zip(FEATURE_NAMES, best_fi), key=lambda x: x[1], reverse=True)
    importance_export["best_model"] = {f: float(round(i, 6)) for f, i in ranked_best}
    print(f"\n  Best Model ({best_name}) â€” Top 10 Features:")
    for feat, imp in ranked_best[:10]:
        bar = "â–ˆ" * int(imp * 60)
        print(f"  {feat:<20} {imp:>10.4f}  {bar}")
    print(f"\n  â†’ Key insight: '{ranked_best[0][0]}' is the most influential feature.")
    print(f"    This means {'training frequency drives split type most.'}")

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# STEP 11 â€” SAVE ARTEFACTS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
print("\n" + "â”"*60)
print("STEP 11 â€” Save Artefacts")
print("â”"*60)

with open(MODEL_PATH,   "wb") as f: pickle.dump(best_model, f)
with open(ENCODER_PATH, "wb") as f: pickle.dump(label_enc,  f)

meta = {
    "best_model":              best_name,
    "cv_accuracy":             round(best["cv_mean"]    * 100, 2),
    "test_accuracy":           round(best["test_acc"]   * 100, 2),
    "macro_f1":                round(best["f1_macro"]   * 100, 2),
    "weighted_f1":             round(best["f1_weighted"] * 100, 2),
    "features":                FEATURE_NAMES,
    "n_features":              len(FEATURE_NAMES),
    "n_classes":               len(label_enc.classes_),
    "classes":                 list(label_enc.classes_),
    "smote_applied":           True,
    "dataset_size":            len(df),
    "train_size_after_smote":  int(len(X_train_res)),
    "encodings": {
        "experience": exp_map,
        "goal":       goal_map,
        "gender":     gender_map,
    },
    # Integration guide â€” matches workout_ml_predictor.py
    "integration": {
        "import": "from app.ml.workout_ml_predictor import predict_split_with_proba",
        "usage":  "predict_split_with_proba(goal_type, activity_level, gender, age)",
        "returns": {"split": "str", "probas": "dict[str, float]"},
        "goal_type_values":     ["bulking", "cutting", "maintaining", "recomp"],
        "activity_level_values":["sedentary", "light", "moderate", "active", "very_active"],
        "gender_values":        ["male", "female"],
    },
}
with open(os.path.join(MODEL_DIR, "workout_model_meta.json"), "w") as f:
    json.dump(meta, f, indent=2)

with open(IMP_PATH, "w") as f:
    json.dump(importance_export, f, indent=2)

print(f"  [OK] {MODEL_PATH}")
print(f"  [OK] {ENCODER_PATH}")
print(f"  [OK] {os.path.join(MODEL_DIR, 'workout_model_meta.json')}")
print(f"  [OK] {IMP_PATH}")
print("\n  Done! Workout split classifier is ready for integration.")
print(f"\n  Quick test:")
print(f"    from app.ml.workout_ml_predictor import predict_split_with_proba")
print(f"    print(predict_split_with_proba('bulking', 'active', 'male', 22))")

