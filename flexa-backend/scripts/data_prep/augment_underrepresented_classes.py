"""
Augment underrepresented image classes up to a target count.

Usage:
  d:/CUI'26/FYP/Flexa/.venv/Scripts/python.exe flexa-backend/scripts/data_prep/augment_underrepresented_classes.py \
      --dataset-dir "d:/CUI'26/FYP/Flexa/Datasets/Vegetables & Fruits" \
      --target-count 300

Notes:
- Original files are never modified.
- New files are saved as: aug_XXXXXX.jpg in each class folder.
- Only classes with fewer than target-count images are augmented.
"""

from __future__ import annotations

import argparse
import random
from pathlib import Path
from typing import List

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

VALID_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def list_images(class_dir: Path) -> List[Path]:
    return [p for p in class_dir.iterdir() if p.is_file() and p.suffix.lower() in VALID_EXT]


def random_augment(img: Image.Image, rng: random.Random) -> Image.Image:
    """Apply a randomized but label-preserving augmentation chain."""
    out = img.convert("RGB")

    # Random horizontal flip
    if rng.random() < 0.5:
        out = ImageOps.mirror(out)

    # Mild random rotation
    angle = rng.uniform(-20, 20)
    out = out.rotate(angle, resample=Image.Resampling.BICUBIC, expand=False)

    # Random crop + resize back to original size
    w, h = out.size
    crop_scale = rng.uniform(0.82, 0.98)
    cw, ch = max(16, int(w * crop_scale)), max(16, int(h * crop_scale))
    left = rng.randint(0, max(0, w - cw))
    top = rng.randint(0, max(0, h - ch))
    out = out.crop((left, top, left + cw, top + ch)).resize((w, h), Image.Resampling.BICUBIC)

    # Color jitter
    out = ImageEnhance.Brightness(out).enhance(rng.uniform(0.82, 1.18))
    out = ImageEnhance.Contrast(out).enhance(rng.uniform(0.82, 1.18))
    out = ImageEnhance.Color(out).enhance(rng.uniform(0.82, 1.18))

    # Occasional mild blur to simulate camera softness
    if rng.random() < 0.2:
        out = out.filter(ImageFilter.GaussianBlur(radius=rng.uniform(0.2, 1.0)))

    return out


def next_aug_index(class_dir: Path) -> int:
    idx = 1
    while (class_dir / f"aug_{idx:06d}.jpg").exists():
        idx += 1
    return idx


def augment_class(class_dir: Path, target_count: int, seed: int) -> tuple[int, int]:
    images = list_images(class_dir)
    original_count = len(images)

    if original_count == 0 or original_count >= target_count:
        return original_count, 0

    rng = random.Random(seed + hash(class_dir.name) % 1_000_000)
    aug_idx = next_aug_index(class_dir)
    created = 0

    # Use originals plus already-created augmentations to diversify further samples.
    pool = images[:]

    while len(pool) < target_count:
        src = rng.choice(pool)
        with Image.open(src) as img:
            aug = random_augment(img, rng)

        out_name = class_dir / f"aug_{aug_idx:06d}.jpg"
        aug.save(out_name, format="JPEG", quality=95)
        pool.append(out_name)
        aug_idx += 1
        created += 1

    return original_count, created


def run(dataset_dir: Path, target_count: int, seed: int) -> None:
    if not dataset_dir.exists() or not dataset_dir.is_dir():
        raise FileNotFoundError(f"Dataset directory not found: {dataset_dir}")

    class_dirs = sorted([d for d in dataset_dir.iterdir() if d.is_dir()])
    if not class_dirs:
        raise RuntimeError(f"No class folders found in: {dataset_dir}")

    print(f"[INFO] Dataset: {dataset_dir}")
    print(f"[INFO] Target count per class: {target_count}")
    print(f"[INFO] Classes found: {len(class_dirs)}")

    total_created = 0
    augmented_classes = 0

    for class_dir in class_dirs:
        before, created = augment_class(class_dir, target_count, seed)
        after = before + created
        if created > 0:
            augmented_classes += 1
            total_created += created
            print(f"  [AUG] {class_dir.name:<25} {before:>4} -> {after:>4}  (+{created})")
        else:
            print(f"  [SKIP] {class_dir.name:<25} {before:>4}")

    print("\n[SUMMARY]")
    print(f"  Augmented classes: {augmented_classes}")
    print(f"  New images created: {total_created}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Augment underrepresented classes to a target image count")
    parser.add_argument("--dataset-dir", type=Path, required=True, help="Path to folder containing class subfolders")
    parser.add_argument("--target-count", type=int, default=300, help="Target image count per class")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    run(dataset_dir=args.dataset_dir, target_count=args.target_count, seed=args.seed)


if __name__ == "__main__":
    main()
