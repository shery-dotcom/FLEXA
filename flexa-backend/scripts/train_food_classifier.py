"""
Flexa – Module 3: Food Image Classifier
========================================
Architecture : ResNet-50 (ImageNet pretrained) + Dropout(0.3) + Linear(2048→101)
Dataset      : Food-101  (75 750 train / 25 250 test, official split from JSON)
Training     : Phase 1 – head only (frozen backbone), Phase 2 – layer3+layer4 unfrozen
Output       : flexa-backend/models/food_classifier.pt
              flexa-backend/models/food_class_map.json   (idx → class label)

Usage:
    cd flexa-backend
    python scripts/train_food_classifier.py

Notes:
    - With NVIDIA GPU training takes ≈ 20-40 min total
    - Best val accuracy expected: 75–82% top-1 on Food-101
    - The FC architecture here MUST match food_classifier.py exactly:
        model.fc = nn.Sequential(nn.Dropout(0.3), nn.Linear(2048, 101))
"""
import os
import sys
import json
import time
from pathlib import Path

# ─── Paths ─────────────────────────────────────────────────────────────────
ROOT       = Path(__file__).resolve().parents[2]
DATA_DIR   = ROOT / "Datasets" / "food-101"
IMAGES_DIR = DATA_DIR / "images"
META_DIR   = DATA_DIR / "meta"
MODEL_DIR  = Path(__file__).resolve().parents[1] / "models"
MODEL_PATH = MODEL_DIR / "food_classifier.pt"
MAP_PATH   = MODEL_DIR / "food_class_map.json"

MODEL_DIR.mkdir(parents=True, exist_ok=True)

# ─── Hyper-parameters ───────────────────────────────────────────────────────
EPOCHS_FROZEN   = 5      # head-only  (backbone frozen)
EPOCHS_FINETUNE = 3      # layer3+4 unfrozen
BATCH_SIZE      = 64
LR_HEAD         = 1e-3
LR_FINETUNE     = 1e-4
IMG_SIZE        = 224
NUM_CLASSES     = 101
NUM_WORKERS     = 4      # set to 0 if multiprocessing crashes on Windows


# ────────────────────────────────────────────────────────────────────────────
# Custom Dataset using Food-101's official JSON split
# ────────────────────────────────────────────────────────────────────────────
class Food101Dataset:
    """
    Reads train.json or test.json from Food-101/meta/.
    JSON format: { "class_name": ["class_name/image_id", ...], ... }
    """
    def __init__(self, split: str, transform=None):
        assert split in ("train", "test")
        json_path = META_DIR / f"{split}.json"
        with open(json_path) as f:
            split_data = json.load(f)

        # Sorted so class→idx mapping is deterministic
        self.classes      = sorted(split_data.keys())
        self.class_to_idx = {c: i for i, c in enumerate(self.classes)}

        self.paths  = []
        self.labels = []
        for cls, img_ids in split_data.items():
            idx = self.class_to_idx[cls]
            for img_id in img_ids:
                self.paths.append(IMAGES_DIR / f"{img_id}.jpg")
                self.labels.append(idx)

        self.transform = transform

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, i):
        from PIL import Image
        img = Image.open(self.paths[i]).convert("RGB")
        if self.transform:
            img = self.transform(img)
        return img, self.labels[i]


# ────────────────────────────────────────────────────────────────────────────
# Model builder — architecture MUST match food_classifier.py
# ────────────────────────────────────────────────────────────────────────────
def build_model(num_classes: int, freeze_backbone: bool = True):
    import torch.nn as nn
    from torchvision.models import resnet50, ResNet50_Weights

    model = resnet50(weights=ResNet50_Weights.IMAGENET1K_V1)
    if freeze_backbone:
        for param in model.parameters():
            param.requires_grad = False

    # ⚠️  This Sequential structure MUST match food_classifier.py load code
    model.fc = nn.Sequential(
        nn.Dropout(0.3),
        nn.Linear(model.fc.in_features, num_classes),
    )
    return model


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

    if not IMAGES_DIR.exists():
        print(f"[ERROR] Food-101 images not found at {IMAGES_DIR}")
        sys.exit(1)

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

    # ── Datasets (official Food-101 split) ──────────────────────────────
    print("[INFO] Loading Food-101 official train/test split …")
    train_ds = Food101Dataset("train", transform=train_tf)
    val_ds   = Food101Dataset("test",  transform=val_tf)
    print(f"[INFO] Train: {len(train_ds):,} | Val: {len(val_ds):,} | Classes: {len(train_ds.classes)}")

    # Save class map now so inference works even before training ends
    idx_to_class = {str(v): k for k, v in train_ds.class_to_idx.items()}
    with open(MAP_PATH, "w") as f:
        json.dump(idx_to_class, f, indent=2)
    print(f"[INFO] Class map saved → {MAP_PATH}")

    train_loader = DataLoader(
        train_ds, batch_size=BATCH_SIZE, shuffle=True,
        num_workers=NUM_WORKERS, pin_memory=True,
    )
    val_loader = DataLoader(
        val_ds, batch_size=BATCH_SIZE, shuffle=False,
        num_workers=NUM_WORKERS, pin_memory=True,
    )

    # ── Model ────────────────────────────────────────────────────────────
    print("[INFO] Building ResNet-50 (ImageNet pretrained, frozen backbone) …")
    model = build_model(NUM_CLASSES, freeze_backbone=True).to(device)
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"[INFO] Trainable params: {trainable:,}")

    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    best_val  = 0.0

    # ── Phase 1: Head-only ───────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f" PHASE 1 — Classifier head only ({EPOCHS_FROZEN} epochs)")
    print(f"{'='*60}")
    optimizer = optim.Adam(model.fc.parameters(), lr=LR_HEAD, weight_decay=1e-4)
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
    for name, param in model.named_parameters():
        if any(x in name for x in ("layer3", "layer4", "fc")):
            param.requires_grad = True
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
    print(f" Model             : {MODEL_PATH}")
    print(f" Class map         : {MAP_PATH}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
