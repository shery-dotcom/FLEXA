# Flexa Model Results and Metrics

Generated: 2026-04-23

This report summarizes measurable results currently available in the project artifacts and reproducible evaluation runs.

## 1) Workout Split Recommendation Model (Module 4)

### 1.1 Saved model metadata (from trained artifact)

Source: flexa-backend/app/ml/workout_model_meta.json

- Best model: Tuned XGBoost + SMOTE
- Cross-validation accuracy: 66.61%
- Test accuracy: 47.73%
- Macro F1: 46.79%
- Weighted F1: 47.88%
- Number of features: 18
- Number of classes: 5
- Dataset size (cleaned): 436
- Train size after SMOTE/Tomek: 422
- Classes:
  - Bro Split
  - Full Body
  - PPL
  - PPL x2
  - Upper/Lower

### 1.2 Extended reproducible test metrics (computed from saved model)

Model artifact: flexa-backend/app/ml/workout_model.pkl
Label encoder: flexa-backend/app/ml/workout_label_encoder.pkl
Dataset: flexa-frontend/WorkoutPlanning_Dataset.xlsx
Split: stratified 80/20, random_state=42

- Total samples: 436
- Test samples: 88
- Number of classes: 5

Core classification metrics:

- Accuracy: 0.477273 (47.73%)
- Balanced Accuracy: 0.480065 (48.01%)
- Macro Precision: 0.481581 (48.16%)
- Macro Recall: 0.480065 (48.01%)
- Macro F1: 0.467871 (46.79%)
- Weighted Precision: 0.510298 (51.03%)
- Weighted Recall: 0.477273 (47.73%)
- Weighted F1: 0.478828 (47.88%)

Agreement/robustness metrics:

- Matthews Correlation Coefficient (MCC): 0.351246
- Cohen's Kappa: 0.346253

Ranking/probability quality metrics:

- Top-2 Accuracy: 0.659091 (65.91%)
- Top-3 Accuracy: 0.863636 (86.36%)
- Log Loss: 1.366030

Multiclass ROC-AUC:

- AUC OVR Macro: 0.779397
- AUC OVR Weighted: 0.783212
- AUC OVO Macro: 0.780954
- AUC OVO Weighted: 0.781886

### 1.3 Per-class metrics (test set)

- Bro Split: precision=0.4444, recall=0.4000, f1=0.4211, support=20
- Full Body: precision=0.3846, recall=0.5882, f1=0.4651, support=17
- PPL: precision=0.1538, recall=0.1429, f1=0.1481, support=14
- PPL x2: precision=0.6250, recall=0.7692, f1=0.6897, support=13
- Upper/Lower: precision=0.8000, recall=0.5000, f1=0.6154, support=24

### 1.4 Confusion matrix (rows=actual, cols=predicted)

Label order: [Bro Split, Full Body, PPL, PPL x2, Upper/Lower]

- [8, 1, 4, 5, 2]
- [3, 10, 2, 1, 1]
- [3, 9, 2, 0, 0]
- [1, 0, 2, 10, 0]
- [3, 6, 3, 0, 12]

### 1.5 Feature importance (best model)

Source: flexa-backend/app/ml/workout_feature_importance.json

Top 10 features by importance:

1. freq_bin: 0.139840
2. frequency: 0.115871
3. freq_sq: 0.110315
4. exp_enc: 0.060359
5. freq_x_exp: 0.053231
6. goal_bulk: 0.051462
7. exp_x_goal: 0.051434
8. exp_adv: 0.048044
9. goal_cut: 0.045382
10. freq_x_goal: 0.042223

### 1.6 Workout dataset profile

Dataset source: flexa-frontend/WorkoutPlanning_Dataset.xlsx

- Rows after cleaning: 436
- Age range: 14 to 74
- Age mean: 27.54
- Age median: 25.00

Target distribution (Workout Split):

- Upper/Lower: 118 (27.06%)
- Bro Split: 99 (22.71%)
- Full Body: 82 (18.81%)
- PPL: 70 (16.06%)
- PPL x2: 67 (15.37%)

Class imbalance ratio (max/min): 1.7612

## 2) Food Image Classification Model (Module 3)

### 2.1 Available model metadata

Source: flexa-backend/models/food_model_meta.json

- Architecture: mobilenet_v3_large
- Image size: 192
- Normalization mean: [0.485, 0.456, 0.406]
- Normalization std: [0.229, 0.224, 0.225]
- Number of classes: 217

Class map source: flexa-backend/models/food_class_map.json

- Merged class count from map: 217

### 2.2 Training dataset composition

Derived from:

- Datasets/food-101/meta/train.json + test.json
- Datasets/Pakistani Food Images
- Datasets/Vegetables & Fruits

Food-101:

- Classes: 101
- Train images: 75,750
- Validation images: 25,250

Pakistani Food Images (folder split 80/20 in script):

- Classes: 80
- Total images: 4,000
- Train images: 3,200
- Validation images: 800
- Min/Max/Avg per class: 50 / 50 / 50.00

Vegetables and Fruits (folder split 80/20 in script):

- Classes: 36
- Total images: 10,800
- Train images: 8,640
- Validation images: 2,160
- Min/Max/Avg per class: 300 / 300 / 300.00

Combined training setup totals:

- Combined train images: 87,590
- Combined validation images: 28,210
- Combined total images: 115,800
- Combined classes in model map: 217

### 2.3 Important limitation for documentation

At present, this repository includes architecture/data metadata for the food image model, but does not include a saved evaluation report file (for example: top-1 accuracy, top-5 accuracy, macro F1, per-class recall, confusion matrix).

The training script prints best validation accuracy at training time, but this value is not persisted to metadata by default.

## 3) Suggested wording for thesis/report

Use this as-is if helpful:

"For the Workout Split Recommender, the final deployed classifier was Tuned XGBoost + SMOTE. On a stratified 80/20 test split (n=88), it achieved 47.73% accuracy, 46.79% macro-F1, and 47.88% weighted-F1. Despite moderate top-1 performance, ranking quality was stronger (Top-2 accuracy: 65.91%, Top-3 accuracy: 86.36%), with multiclass ROC-AUC around 0.78 (OVR macro AUC: 0.779). The most influential features were training-frequency-derived terms (freq_bin, frequency, freq_sq), indicating that weekly training frequency and its interactions were primary drivers of predicted split type."

"For the Food Image Classifier, the current deployed metadata indicates a MobileNetV3-Large architecture at 192x192 input resolution with 217 output classes, trained over a merged 115,800-image corpus (Food-101, Pakistani Food Images, and Vegetables/Fruits datasets)."

## 4) Reproducibility references

- Workout training/evaluation pipeline: flexa-backend/app/ml/train_model.py
- Workout predictor loader: flexa-backend/app/ml/workout_ml_predictor.py
- Food training pipeline: flexa-backend/scripts/train_food_classifier.py
- Food inference service: flexa-backend/app/ml/food_classifier.py
