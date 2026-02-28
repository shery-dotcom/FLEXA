"""
Flexa Workout Split Classifier — Training Script
================================================
XGBoost primary model + SMOTE oversampling + feature engineering
Saves best CV model as workout_model.pkl and label_encoder.pkl
"""
import os, json, pickle, warnings
warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np
from sklearn.model_selection import (
    train_test_split, StratifiedKFold, RandomizedSearchCV, cross_val_score
)
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import classification_report, accuracy_score
from sklearn.ensemble import (
    RandomForestClassifier, ExtraTreesClassifier, VotingClassifier
)
from sklearn.svm import SVC
from sklearn.pipeline import Pipeline as SkPipeline
from xgboost import XGBClassifier
from imblearn.over_sampling import SMOTE, ADASYN
from imblearn.pipeline import Pipeline as ImbPipeline
from imblearn.combine import SMOTETomek

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(
    "d:\\", "CUI'26", "FYP", "Flexa", "flexa-frontend", "WorkoutPlanning_Dataset.xlsx"
)
MODEL_DIR = BASE_DIR  # save next to this script
MODEL_PATH = os.path.join(MODEL_DIR, "workout_model.pkl")
ENCODER_PATH = os.path.join(MODEL_DIR, "workout_label_encoder.pkl")

# ── Load & Clean ─────────────────────────────────────────────────────────────
print("Loading dataset...")
df = pd.read_excel(DATASET_PATH)

# Rename to short names
RENAME = {
    df.columns[1]: "name",
    df.columns[2]: "age",
    df.columns[3]: "gender",
    df.columns[4]: "frequency",
    df.columns[5]: "experience",
    df.columns[6]: "goal",
    df.columns[7]: "split",      # TARGET
}
df = df.rename(columns=RENAME).drop(columns=["Timestamp", "name"], errors="ignore")
df = df.dropna(subset=["frequency", "experience", "goal", "split"])

print(f"Dataset: {len(df)} rows, columns: {list(df.columns)}")

# ── Normalise values ──────────────────────────────────────────────────────────
def norm_freq(v):
    v = str(v).strip()
    for d in ["2","3","4","5","6"]:
        if v.startswith(d):
            return int(d)
    return 3  # fallback

def norm_exp(v):
    v = str(v).lower()
    if "begin" in v: return "Beginner"
    if "inter" in v: return "Intermediate"
    return "Advanced"

def norm_goal(v):
    v = str(v).lower()
    if "bulk" in v: return "Bulking"
    if "cut" in v:  return "Cutting"
    return "Maintaining"  # recomp / maintaining

def norm_split(v):
    v = str(v).strip()
    if "Full Body" in v:          return "Full Body"
    if "PPL x2" in v or "6 days" in v: return "PPL x2"
    if "Push/Pull/Legs" in v:    return "PPL"
    if "Upper/Lower" in v:        return "Upper/Lower"
    if "Bro Split" in v:          return "Bro Split"
    return v

df["frequency"]  = df["frequency"].apply(norm_freq)
df["experience"] = df["experience"].apply(norm_exp)
df["goal"]       = df["goal"].apply(norm_goal)
df["gender"]     = df["gender"].apply(lambda v: "Male" if str(v).lower().startswith("m") else "Female")
df["split"]      = df["split"].apply(norm_split)
df["age"]        = pd.to_numeric(df["age"], errors="coerce").fillna(df["age"].median())

print("\nClass distribution:")
print(df["split"].value_counts())

# ── Encode Features ───────────────────────────────────────────────────────────
freq_order = [2, 3, 4, 5, 6]
exp_map    = {"Beginner": 0, "Intermediate": 1, "Advanced": 2}
goal_map   = {"Cutting": 0, "Maintaining": 1, "Bulking": 2}
gender_map = {"Female": 0, "Male": 1}

df["exp_enc"]    = df["experience"].map(exp_map)
df["goal_enc"]   = df["goal"].map(goal_map)
df["gender_enc"] = df["gender"].map(gender_map)

FEATURES = ["frequency", "exp_enc", "goal_enc", "gender_enc", "age"]
X_base = df[FEATURES].values.astype(float)

# ── Feature Engineering ───────────────────────────────────────────────────────
print("\nApplying feature engineering...")

freq     = df["frequency"].values.astype(float)
exp_e    = df["exp_enc"].values.astype(float)
goal_e   = df["goal_enc"].values.astype(float)
age      = df["age"].values.astype(float)
gender_e = df["gender_enc"].values.astype(float)

# 1. Interaction: frequency × experience (high freq + advanced → PPL x2/Bro)
freq_x_exp  = freq * exp_e

# 2. Interaction: frequency × goal
freq_x_goal = freq * goal_e

# 3. Interaction: experience × goal
exp_x_goal  = exp_e * goal_e

# 4. Frequency squared (non-linear effort curve)
freq_sq = freq ** 2

# 5. Frequency bin: 0=low(2-3), 1=mid(4-5), 2=high(6)
freq_bin = np.where(freq <= 3, 0, np.where(freq <= 5, 1, 2)).astype(float)

# 6. Age group: 0=teen/young(≤25), 1=adult(26-40), 2=mature(>40)
age_grp = np.where(age <= 25, 0, np.where(age <= 40, 1, 2)).astype(float)

# 7. One-hot encode goal (3 binary features instead of 1 ordinal)
goal_cut  = (goal_e == 0).astype(float)
goal_main = (goal_e == 1).astype(float)
goal_bulk = (goal_e == 2).astype(float)

# 8. One-hot encode experience
exp_beg   = (exp_e == 0).astype(float)
exp_inter = (exp_e == 1).astype(float)
exp_adv   = (exp_e == 2).astype(float)

# 9. Effort score: freq × (exp_enc + 1)  — combines training dedication signals
effort = freq * (exp_e + 1)

X = np.column_stack([
    freq, exp_e, goal_e, gender_e, age,   # base features
    freq_x_exp, freq_x_goal, exp_x_goal,  # interactions
    freq_sq, freq_bin, age_grp,            # transformed
    goal_cut, goal_main, goal_bulk,        # goal one-hot
    exp_beg, exp_inter, exp_adv,           # exp one-hot
    effort,                                # effort score
])

FEATURE_NAMES = [
    "frequency", "exp_enc", "goal_enc", "gender_enc", "age",
    "freq_x_exp", "freq_x_goal", "exp_x_goal",
    "freq_sq", "freq_bin", "age_grp",
    "goal_cut", "goal_main", "goal_bulk",
    "exp_beg", "exp_inter", "exp_adv",
    "effort",
]
print(f"Feature matrix: {X.shape[0]} rows × {X.shape[1]} features")

label_enc = LabelEncoder()
y = label_enc.fit_transform(df["split"])

print("\nLabel classes:", list(label_enc.classes_))

# ── Train / Test Split ────────────────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
print(f"\nTrain: {len(X_train)}   Test: {len(X_test)}")

# ── SMOTE Oversampling on training set ───────────────────────────────────────
print("\nApplying SMOTETomek (oversample minority + remove Tomek links)...")
smote_tomek = SMOTETomek(random_state=42)
X_train_res, y_train_res = smote_tomek.fit_resample(X_train, y_train)
print(f"After SMOTETomek: {len(X_train_res)} training samples")
unique, counts = np.unique(y_train_res, return_counts=True)
for cls_idx, cnt in zip(unique, counts):
    print(f"  {label_enc.classes_[cls_idx]}: {cnt}")

# ── Step 1: Baseline comparison (no SMOTE) ───────────────────────────────────
print("\n" + "="*60)
print("STEP 1 — BASELINE MODELS (raw train set)")
print("="*60)

cv = StratifiedKFold(n_splits=10, shuffle=True, random_state=42)

baselines = {
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
    "Random Forest (baseline)": RandomForestClassifier(
        n_estimators=500, max_depth=8, class_weight="balanced",
        random_state=42, n_jobs=-1,
    ),
}

results = {}
for name, clf in baselines.items():
    # CV on full dataset for fair comparison
    cv_scores = cross_val_score(clf, X, y, cv=cv, scoring="accuracy", n_jobs=-1)
    clf.fit(X_train, y_train)
    y_pred = clf.predict(X_test)
    test_acc = accuracy_score(y_test, y_pred)
    results[name] = {"cv_mean": cv_scores.mean(), "cv_std": cv_scores.std(),
                     "test_acc": test_acc, "model": clf}
    print(f"\n{name}:  CV={cv_scores.mean()*100:.1f}%±{cv_scores.std()*100:.1f}%  "
          f"Test={test_acc*100:.1f}%")

# ── Step 2: SMOTE-enhanced pipelines via imblearn Pipeline ───────────────────
print("\n" + "="*60)
print("STEP 2 — SMOTE PIPELINES (SMOTE inside each CV fold)")
print("="*60)

# imblearn Pipeline applies SMOTE only on training folds → no data leakage
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
    cv_scores = cross_val_score(pipeline, X, y, cv=cv, scoring="accuracy", n_jobs=-1)
    pipeline.fit(X_train_res, y_train_res)  # fit on resampled for test eval
    y_pred = pipeline.predict(X_test)
    test_acc = accuracy_score(y_test, y_pred)
    results[name] = {"cv_mean": cv_scores.mean(), "cv_std": cv_scores.std(),
                     "test_acc": test_acc, "model": pipeline}
    print(f"\n{name}:  CV={cv_scores.mean()*100:.1f}%±{cv_scores.std()*100:.1f}%  "
          f"Test={test_acc*100:.1f}%")

# ── Step 3: XGBoost RandomizedSearchCV (fit on SMOTE-resampled train) ────────
print("\n" + "="*60)
print("STEP 3 — XGBoost RandomizedSearchCV (tuning on SMOTE data)")
print("="*60)

xgb_param_grid = {
    "n_estimators":      [300, 500, 700, 1000],
    "max_depth":         [3, 4, 5, 6],
    "learning_rate":     [0.01, 0.03, 0.05, 0.08, 0.1],
    "subsample":         [0.7, 0.8, 0.85, 0.9],
    "colsample_bytree":  [0.7, 0.8, 0.85, 0.9],
    "min_child_weight":  [1, 2, 3, 4],
    "gamma":             [0, 0.05, 0.1, 0.2, 0.3],
    "reg_alpha":         [0, 0.05, 0.1, 0.2],
    "reg_lambda":        [0.5, 1.0, 1.5, 2.0],
}

xgb_search = RandomizedSearchCV(
    XGBClassifier(eval_metric="mlogloss", random_state=42, verbosity=0),
    xgb_param_grid,
    n_iter=60,
    cv=StratifiedKFold(n_splits=10, shuffle=True, random_state=42),
    scoring="accuracy",
    random_state=42,
    n_jobs=-1,
    refit=True,
)
xgb_search.fit(X_train_res, y_train_res)
xgb_tuned = xgb_search.best_estimator_
y_pred_xgb = xgb_tuned.predict(X_test)
xgb_test_acc = accuracy_score(y_test, y_pred_xgb)

print(f"\nTuned XGBoost (SMOTE data):")
print(f"  Best params: {xgb_search.best_params_}")
print(f"  CV Accuracy: {xgb_search.best_score_*100:.1f}%")
print(f"  Test Accuracy: {xgb_test_acc*100:.1f}%")
print(classification_report(y_test, y_pred_xgb, target_names=label_enc.classes_, zero_division=0))

results["Tuned XGBoost + SMOTE"] = {
    "cv_mean": xgb_search.best_score_, "cv_std": 0.0,
    "test_acc": xgb_test_acc, "model": xgb_tuned,
}

# ── Step 4: Soft Voting Ensemble (top 3 models on SMOTE data) ────────────────
print("\n" + "="*60)
print("STEP 4 — Soft Voting Ensemble (XGBoost + Extra Trees + SVM)")
print("="*60)

ensemble = VotingClassifier(
    estimators=[
        ("xgb", XGBClassifier(
            **xgb_search.best_params_,
            eval_metric="mlogloss", random_state=42, verbosity=0,
        )),
        ("et", ExtraTreesClassifier(
            n_estimators=600, max_depth=None, min_samples_split=3,
            min_samples_leaf=1, max_features="sqrt",
            class_weight="balanced", random_state=42, n_jobs=-1,
        )),
        ("svm", SkPipeline([
            ("scaler", StandardScaler()),
            ("clf", SVC(kernel="rbf", C=10, gamma="scale",
                        probability=True, class_weight="balanced", random_state=42)),
        ])),
    ],
    voting="soft",
)
ensemble.fit(X_train_res, y_train_res)
y_pred_ens = ensemble.predict(X_test)
ens_test_acc = accuracy_score(y_test, y_pred_ens)
ens_cv = cross_val_score(ensemble, X_train_res, y_train_res,
                         cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=42),
                         scoring="accuracy", n_jobs=-1)
print(f"\nSoft Ensemble (SMOTE data):  CV={ens_cv.mean()*100:.1f}%  Test={ens_test_acc*100:.1f}%")
print(classification_report(y_test, y_pred_ens, target_names=label_enc.classes_, zero_division=0))
results["Soft Ensemble + SMOTE"] = {
    "cv_mean": ens_cv.mean(), "cv_std": ens_cv.std(),
    "test_acc": ens_test_acc, "model": ensemble,
}

# ── Final Selection ───────────────────────────────────────────────────────────
print("="*60)
print("FINAL RESULTS SUMMARY")
print("="*60)
for name, r in sorted(results.items(), key=lambda x: x[1]["cv_mean"], reverse=True):
    print(f"  {name:<35} CV={r['cv_mean']*100:.1f}%  Test={r['test_acc']*100:.1f}%")

best_name  = max(results, key=lambda k: results[k]["cv_mean"])
best_model = results[best_name]["model"]
best_cv    = results[best_name]["cv_mean"]
best_test  = results[best_name]["test_acc"]

print(f"\n{'='*60}")
print(f"WINNER: {best_name}")
print(f"  CV Accuracy:   {best_cv*100:.1f}%")
print(f"  Test Accuracy: {best_test*100:.1f}%")
print(f"{'='*60}")

# ── Save Artifacts ────────────────────────────────────────────────────────────
with open(MODEL_PATH, "wb") as f:
    pickle.dump(best_model, f)
with open(ENCODER_PATH, "wb") as f:
    pickle.dump(label_enc, f)

meta = {
    "best_model":    best_name,
    "cv_accuracy":   round(best_cv * 100, 2),
    "test_accuracy": round(best_test * 100, 2),
    "features":      FEATURE_NAMES,
    "n_features":    len(FEATURE_NAMES),
    "n_classes":     len(label_enc.classes_),
    "classes":       list(label_enc.classes_),
    "smote_applied": True,
    "dataset_size":  len(df),
    "train_size_after_smote": len(X_train_res),
    "encodings": {"experience": exp_map, "goal": goal_map, "gender": gender_map},
}
with open(os.path.join(MODEL_DIR, "workout_model_meta.json"), "w") as f:
    json.dump(meta, f, indent=2)

print(f"\nSaved: {MODEL_PATH}")
print(f"Saved: {ENCODER_PATH}")
print(f"Saved: workout_model_meta.json")
print("\nDone! Workout split classifier is ready.")
