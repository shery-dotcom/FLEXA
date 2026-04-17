"""
Flexa – Module 3: Food Image Classifier
========================================
Architecture : configurable (MobileNetV3-Large default for mobile, ResNet-50 optional)
Datasets     : Food-101  (75 750 train / 25 250 test, official split from JSON)
               Pakistani Food Images (folder-based, 80/20 random split)
               Vegetables & Fruits   (folder-based, 80/20 random split)
Training     : Phase 1 – head only (frozen backbone), Phase 2 – selective unfreeze
Output       : flexa-backend/models/food_classifier.pt
              flexa-backend/models/food_class_map.json   (idx → class label)
              flexa-backend/models/food_model_meta.json  (arch + preprocessing)

Usage:
    cd flexa-backend
    python scripts/train_food_classifier.py

Notes:
    - With NVIDIA GPU training takes ≈ 40-70 min total for combined dataset
    - Model metadata is saved so inference can rebuild the exact architecture.
    - NUM_CLASSES is determined automatically from all three datasets combined.
"""
import os
import sys
import json
import time
import random
from pathlib import Path

from PIL import Image, ImageFile

# Do not fail on partially truncated JPEG streams.
ImageFile.LOAD_TRUNCATED_IMAGES = True

# ─── Paths ─────────────────────────────────────────────────────────────────
ROOT       = Path(__file__).resolve().parents[2]
DATA_DIR   = ROOT / "Datasets" / "food-101"
IMAGES_DIR = DATA_DIR / "images"
META_DIR   = DATA_DIR / "meta"
PAK_IMAGES_DIR  = ROOT / "Datasets" / "Pakistani Food Images"
VEG_IMAGES_DIR  = ROOT / "Datasets" / "Vegetables & Fruits"
MODEL_DIR  = Path(__file__).resolve().parents[1] / "models"
MODEL_PATH = MODEL_DIR / "food_classifier.pt"
MAP_PATH   = MODEL_DIR / "food_class_map.json"
META_PATH  = MODEL_DIR / "food_model_meta.json"

MODEL_DIR.mkdir(parents=True, exist_ok=True)

# ─── Hyper-parameters ───────────────────────────────────────────────────────
EPOCHS_FROZEN   = 5      # head-only  (backbone frozen)
EPOCHS_FINETUNE = 3      # selective unfreeze
BATCH_SIZE      = 64
LR_HEAD         = 1e-3
LR_FINETUNE     = 1e-4
MODEL_ARCH      = os.getenv("FOOD_MODEL_ARCH", "mobilenet_v3_large").strip().lower()
IMG_SIZE        = int(os.getenv("FOOD_IMG_SIZE", "192"))
NUM_WORKERS     = 4      # set to 0 if multiprocessing crashes on Windows
RANDOM_SEED     = 42


# ────────────────────────────────────────────────────────────────────────────
# Helper: discover all classes across all 3 datasets (sorted for determinism)
# ────────────────────────────────────────────────────────────────────────────
def _discover_all_classes() -> dict:
    """
    Returns a global class_to_idx dict built from ALL three datasets.
    Class names are normalised: underscores→spaces, lower-cased.
    Returns {class_name: global_index}
    """
    all_classes = set()

    # Food-101 via JSON
    if (META_DIR / "train.json").exists():
        with open(META_DIR / "train.json") as f:
            f101 = json.load(f)
        for c in f101.keys():
            all_classes.add(c.replace("_", " ").lower())

    # Folder-based datasets
    for base_dir in (PAK_IMAGES_DIR, VEG_IMAGES_DIR):
        if base_dir.exists():
            for folder in base_dir.iterdir():
                if folder.is_dir():
                    all_classes.add(folder.name.replace("_", " ").lower())

    sorted_classes = sorted(all_classes)
    return {c: i for i, c in enumerate(sorted_classes)}


# ────────────────────────────────────────────────────────────────────────────
# Dataset: Food-101 (uses official JSON split)
# ────────────────────────────────────────────────────────────────────────────
class Food101Dataset:
    """
    Reads train.json or test.json from Food-101/meta/.
    JSON format: { "class_name": ["class_name/image_id", ...], ... }
    Uses the GLOBAL class→idx mapping.
    """
    def __init__(self, split: str, global_class_to_idx: dict, transform=None):
        assert split in ("train", "test")
        json_path = META_DIR / f"{split}.json"
        with open(json_path) as f:
            split_data = json.load(f)

        self.paths  = []
        self.labels = []
        for cls, img_ids in split_data.items():
            cls_norm = cls.replace("_", " ").lower()
            idx = global_class_to_idx[cls_norm]
            for img_id in img_ids:
                path = IMAGES_DIR / f"{img_id}.jpg"
                if path.exists():
                    self.paths.append(path)
                    self.labels.append(idx)

        self.transform = transform

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, i):
        # Retry with nearby samples if a file is corrupted.
        for _ in range(5):
            try:
                img = Image.open(self.paths[i]).convert("RGB")
                if self.transform:
                    img = self.transform(img)
                return img, self.labels[i]
            except Exception:
                i = (i + 1) % len(self.paths)
        raise RuntimeError(f"Failed to load image after retries around index {i}")


# ────────────────────────────────────────────────────────────────────────────
# Dataset: Folder-based (Pakistani Food Images & Vegetables & Fruits)
# ────────────────────────────────────────────────────────────────────────────
class FolderImageDataset:
    """
    Generic dataset for folder-organised image datasets:
        root/
          class_a/  *.jpg *.png …
          class_b/  …
    Supports train/test split by index using a seeded shuffle.
    Uses the GLOBAL class→idx mapping.
    """
    VAL_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

    def __init__(
        self,
        root: Path,
        global_class_to_idx: dict,
        split: str = "train",       # "train" | "test"
        val_ratio: float = 0.20,
        seed: int = RANDOM_SEED,
        transform=None,
    ):
        assert split in ("train", "test")
        rng = random.Random(seed)

        self.paths  = []
        self.labels = []

        for folder in sorted(root.iterdir()):
            if not folder.is_dir():
                continue
            cls_norm = folder.name.replace("_", " ").lower()
            if cls_norm not in global_class_to_idx:
                continue
            idx = global_class_to_idx[cls_norm]

            images = sorted(
                p for p in folder.iterdir()
                if p.suffix.lower() in self.VAL_EXTENSIONS
            )
            if not images:
                continue

            shuffled = images[:]
            rng.shuffle(shuffled)
            split_at = max(1, int(len(shuffled) * val_ratio))

            if split == "test":
                chosen = shuffled[:split_at]
            else:
                chosen = shuffled[split_at:]

            for p in chosen:
                self.paths.append(p)
                self.labels.append(idx)

        self.transform = transform

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, i):
        # Retry with nearby samples if a file is corrupted.
        for _ in range(5):
            try:
                img = Image.open(self.paths[i]).convert("RGB")
                if self.transform:
                    img = self.transform(img)
                return img, self.labels[i]
            except Exception:
                i = (i + 1) % len(self.paths)
        raise RuntimeError(f"Failed to load image after retries around index {i}")


# ────────────────────────────────────────────────────────────────────────────
# Combined Dataset: merges multiple dataset objects into one
# ────────────────────────────────────────────────────────────────────────────
class CombinedDataset:
    def __init__(self, datasets: list):
        self.datasets = datasets
        self._lengths = [len(d) for d in datasets]
        self._offsets = []
        offset = 0
        for l in self._lengths:
            self._offsets.append(offset)
            offset += l
        self._total = offset

    def __len__(self):
        return self._total

    def __getitem__(self, i):
        for ds, offset, length in zip(self.datasets, self._offsets, self._lengths):
            if i < offset + length:
                return ds[i - offset]
        raise IndexError(f"Index {i} out of range")


# ────────────────────────────────────────────────────────────────────────────
# Model builder — architecture MUST match food_classifier.py
# ────────────────────────────────────────────────────────────────────────────
def build_model(num_classes: int, freeze_backbone: bool = True, model_arch: str = MODEL_ARCH):
    import torch.nn as nn
    from torchvision.models import (
        mobilenet_v3_large,
        MobileNet_V3_Large_Weights,
        resnet50,
        ResNet50_Weights,
    )

    arch = model_arch.lower()

    if arch == "mobilenet_v3_large":
        model = mobilenet_v3_large(weights=MobileNet_V3_Large_Weights.IMAGENET1K_V2)
        if freeze_backbone:
            for param in model.features.parameters():
                param.requires_grad = False
        in_features = model.classifier[-1].in_features
        model.classifier[-1] = nn.Linear(in_features, num_classes)
        return model

    if arch == "resnet50":
        model = resnet50(weights=ResNet50_Weights.IMAGENET1K_V1)
        if freeze_backbone:
            for param in model.parameters():
                param.requires_grad = False

        model.fc = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(model.fc.in_features, num_classes),
        )
        return model

    raise ValueError(f"Unsupported FOOD_MODEL_ARCH='{model_arch}'. Use 'mobilenet_v3_large' or 'resnet50'.")


def get_head_parameters(model, model_arch: str = MODEL_ARCH):
    arch = model_arch.lower()
    if arch == "mobilenet_v3_large":
        return model.classifier.parameters()
    if arch == "resnet50":
        return model.fc.parameters()
    raise ValueError(f"Unsupported FOOD_MODEL_ARCH='{model_arch}'.")


def unfreeze_for_finetune(model, model_arch: str = MODEL_ARCH) -> None:
    """Unfreeze only deeper layers to keep training stable with mixed datasets."""
    arch = model_arch.lower()

    if arch == "mobilenet_v3_large":
        for name, param in model.named_parameters():
            if any(k in name for k in ("features.13", "features.14", "features.15", "features.16", "classifier")):
                param.requires_grad = True
        return

    if arch == "resnet50":
        for name, param in model.named_parameters():
            if any(x in name for x in ("layer3", "layer4", "fc")):
                param.requires_grad = True
        return

    raise ValueError(f"Unsupported FOOD_MODEL_ARCH='{model_arch}'.")


# ────────────────────────────────────────────────────────────────────────────
# Training / validation loop
# ────────────────────────────────────────────────────────────────────────────
def run_epoch(model, loader, optimizer, criterion, device, phase, epoch, total_epochs):
    import torch
    is_train = (phase == "train")
    model.train(is_train)
    total_loss = correct = total = 0
    t0 = time.time()

    with torch.set_grad_enabled(is_train):
        for batch_idx, (imgs, labels) in enumerate(loader):
            imgs, labels = imgs.to(device), labels.to(device)
            if is_train:
                optimizer.zero_grad()
            outputs = model(imgs)
            loss    = criterion(outputs, labels)
            if is_train:
                loss.backward()
                optimizer.step()

            total_loss += loss.item()
            _, predicted = outputs.max(1)
            total   += labels.size(0)
            correct += predicted.eq(labels).sum().item()

            if batch_idx % 100 == 0:
                elapsed = time.time() - t0
                eta = elapsed / max(batch_idx + 1, 1) * (len(loader) - batch_idx - 1)
                print(
                    f"  [{phase.upper()}] Ep {epoch}/{total_epochs} "
                    f"| Batch {batch_idx}/{len(loader)} "
                    f"| Loss {loss.item():.4f} "
                    f"| Acc {100.*correct/total:.1f}% "
                    f"| ETA {eta/60:.1f}min   ",
                    end="\r",
                )

    avg_loss = total_loss / len(loader)
    acc      = 100. * correct / total
    print(
        f"\n  [{phase.upper()}] Epoch {epoch}/{total_epochs} — "
        f"Loss: {avg_loss:.4f} | Acc: {acc:.2f}%  ({time.time()-t0:.0f}s)"
    )
    return acc


# ────────────────────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────────────────────
def main():
    try:
        import torch
        import torch.nn as nn
        import torch.optim as optim
        from torchvision import transforms
        from torch.utils.data import DataLoader
    except ImportError:
        print("[ERROR] PyTorch not installed.")
        print("  pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126")
        sys.exit(1)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[INFO] Device  : {device}")
    if torch.cuda.is_available():
        print(f"[INFO] GPU     : {torch.cuda.get_device_name(0)}")

    # ── Discover ALL classes across three datasets ───────────────────────
    print("[INFO] Discovering classes from all three datasets …")
    global_class_to_idx = _discover_all_classes()
    NUM_CLASSES = len(global_class_to_idx)
    idx_to_class = {str(v): k for k, v in global_class_to_idx.items()}
    print(f"[INFO] Total classes: {NUM_CLASSES}")
    print(f"[INFO] Model arch  : {MODEL_ARCH}")
    print(f"[INFO] Image size  : {IMG_SIZE}")
    print(f"       Food-101 active: {IMAGES_DIR.exists()}")
    print(f"       Pakistani Food Images active: {PAK_IMAGES_DIR.exists()}")
    print(f"       Vegetables & Fruits active: {VEG_IMAGES_DIR.exists()}")

    # Save class map immediately so inference can work even during training
    with open(MAP_PATH, "w") as f:
        json.dump(idx_to_class, f, indent=2)
    print(f"[INFO] Class map saved → {MAP_PATH}  ({NUM_CLASSES} classes)")

    model_meta = {
        "model_arch": MODEL_ARCH,
        "img_size": IMG_SIZE,
        "normalize_mean": [0.485, 0.456, 0.406],
        "normalize_std": [0.229, 0.224, 0.225],
        "num_classes": NUM_CLASSES,
    }
    with open(META_PATH, "w") as f:
        json.dump(model_meta, f, indent=2)
    print(f"[INFO] Model metadata saved → {META_PATH}")

    # ── Transforms ──────────────────────────────────────────────────────
    train_tf = transforms.Compose([
        transforms.Resize(256),
        transforms.RandomCrop(IMG_SIZE),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.1, hue=0.05),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    val_tf = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(IMG_SIZE),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    # ── Build individual datasets ─────────────────────────────────────────
    train_parts, val_parts = [], []

    # Food-101
    if IMAGES_DIR.exists() and (META_DIR / "train.json").exists():
        print("[INFO] Loading Food-101 …")
        f101_train = Food101Dataset("train", global_class_to_idx, transform=train_tf)
        f101_val   = Food101Dataset("test",  global_class_to_idx, transform=val_tf)
        train_parts.append(f101_train)
        val_parts.append(f101_val)
        print(f"       Food-101 train: {len(f101_train):,} | val: {len(f101_val):,}")
    else:
        print(f"[WARN] Food-101 images not found at {IMAGES_DIR} — skipping.")

    # Pakistani Food Images
    if PAK_IMAGES_DIR.exists():
        print("[INFO] Loading Pakistani Food Images …")
        pak_train = FolderImageDataset(PAK_IMAGES_DIR, global_class_to_idx, "train", transform=train_tf)
        pak_val   = FolderImageDataset(PAK_IMAGES_DIR, global_class_to_idx, "test",  transform=val_tf)
        train_parts.append(pak_train)
        val_parts.append(pak_val)
        print(f"       Pakistani train: {len(pak_train):,} | val: {len(pak_val):,}")
    else:
        print(f"[WARN] Pakistani Food Images not found at {PAK_IMAGES_DIR} — skipping.")

    # Vegetables & Fruits
    if VEG_IMAGES_DIR.exists():
        print("[INFO] Loading Vegetables & Fruits …")
        veg_train = FolderImageDataset(VEG_IMAGES_DIR, global_class_to_idx, "train", transform=train_tf)
        veg_val   = FolderImageDataset(VEG_IMAGES_DIR, global_class_to_idx, "test",  transform=val_tf)
        train_parts.append(veg_train)
        val_parts.append(veg_val)
        print(f"       Veg & Fruit train: {len(veg_train):,} | val: {len(veg_val):,}")
    else:
        print(f"[WARN] Vegetables & Fruits not found at {VEG_IMAGES_DIR} — skipping.")

    if not train_parts:
        print("[ERROR] No dataset directories found. Aborting.")
        sys.exit(1)

    train_ds = CombinedDataset(train_parts)
    val_ds   = CombinedDataset(val_parts)
    print(f"\n[INFO] Combined — Train: {len(train_ds):,} | Val: {len(val_ds):,} | Classes: {NUM_CLASSES}")

    train_loader = DataLoader(
        train_ds, batch_size=BATCH_SIZE, shuffle=True,
        num_workers=NUM_WORKERS, pin_memory=True,
    )
    val_loader = DataLoader(
        val_ds, batch_size=BATCH_SIZE, shuffle=False,
        num_workers=NUM_WORKERS, pin_memory=True,
    )

    # ── Model ────────────────────────────────────────────────────────────
    print(f"\n[INFO] Building {MODEL_ARCH} (ImageNet pretrained, frozen backbone, {NUM_CLASSES} classes) …")
    model = build_model(NUM_CLASSES, freeze_backbone=True, model_arch=MODEL_ARCH).to(device)
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"[INFO] Trainable params: {trainable:,}")

    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    best_val  = 0.0

    # ── Phase 1: Head-only ───────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f" PHASE 1 — Classifier head only ({EPOCHS_FROZEN} epochs)")
    print(f"{'='*60}")
    optimizer = optim.Adam(get_head_parameters(model, MODEL_ARCH), lr=LR_HEAD, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS_FROZEN)

    for epoch in range(1, EPOCHS_FROZEN + 1):
        run_epoch(model, train_loader, optimizer, criterion, device, "train", epoch, EPOCHS_FROZEN)
        val_acc = run_epoch(model, val_loader, None, criterion, device, "val", epoch, EPOCHS_FROZEN)
        scheduler.step()
        if val_acc > best_val:
            best_val = val_acc
            torch.save(model.state_dict(), MODEL_PATH)
            print(f"  [✓] Best val acc: {best_val:.2f}% — checkpoint saved")

    # ── Phase 2: Fine-tune layer3 + layer4 ──────────────────────────────
    print(f"\n{'='*60}")
    print(f" PHASE 2 — Fine-tuning layer3+layer4 ({EPOCHS_FINETUNE} epochs)")
    print(f"{'='*60}")
    unfreeze_for_finetune(model, MODEL_ARCH)
    trainable_ft = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"[INFO] Trainable params (fine-tune): {trainable_ft:,}")

    optimizer_ft = optim.Adam(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=LR_FINETUNE, weight_decay=1e-4,
    )
    scheduler_ft = optim.lr_scheduler.CosineAnnealingLR(optimizer_ft, T_max=EPOCHS_FINETUNE)

    for epoch in range(1, EPOCHS_FINETUNE + 1):
        run_epoch(model, train_loader, optimizer_ft, criterion, device, "train", epoch, EPOCHS_FINETUNE)
        val_acc = run_epoch(model, val_loader, None, criterion, device, "val", epoch, EPOCHS_FINETUNE)
        scheduler_ft.step()
        if val_acc > best_val:
            best_val = val_acc
            torch.save(model.state_dict(), MODEL_PATH)
            print(f"  [✓] Best val acc: {best_val:.2f}% — checkpoint saved")

    print(f"\n{'='*60}")
    print(f" TRAINING COMPLETE")
    print(f" Best Val Accuracy : {best_val:.2f}%")
    print(f" Total Classes     : {NUM_CLASSES}")
    print(f" Model             : {MODEL_PATH}")
    print(f" Class map         : {MAP_PATH}")
    print(f" Model metadata    : {META_PATH}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
