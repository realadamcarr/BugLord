"""Train and evaluate a BugLord classifier on the prepared BIOSCAN v0.1 dataset.

Reads ``prepared/manifest.json`` written by ``prepare_bioscan_v0_1.py`` and the
images under ``prepared/images/<split>/<label>/<internalImageId>.<ext>``.

Two presets:

* ``--preset baseline`` follows ``experiments/bioscan_efficientnet_b0_baseline.json``
  (species target, random init, up to 30 epochs, early stopping).
* ``--preset quick`` fine-tunes ImageNet-pretrained EfficientNet-B0 on a coarser
  rank (``--target order`` by default) for a few epochs, to check quickly
  whether BIOSCAN data transfers to phone photos.

Outputs in ``--out``: ``best.pt`` (weights + label list), ``labels.json``,
``history.json`` and ``report.json`` (top-1, top-5, macro-F1 and a confusion
matrix per evaluation split).

Run ``--predict-dir`` against a folder of photos to print top-3 predictions
for each file using a trained checkpoint.

Requires PyTorch and timm (``pip install -r requirements-pytorch.txt``).
"""

from __future__ import annotations

import argparse
import json
import random
import time
from collections import Counter
from pathlib import Path
from typing import Sequence

ROOT = Path(__file__).resolve().parent
DEFAULT_DATASET = ROOT / "dataset-bioscan-v0.1" / "prepared"
DEFAULT_EXPERIMENT = ROOT / "experiments" / "bioscan_efficientnet_b0_baseline.json"
TAXONOMY_RANKS = ("order", "family", "subfamily", "genus", "species")
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
# Manifest split names -> roles used here
TRAIN_SPLIT, VAL_SPLIT = "train", "validation"
EVAL_SPLITS = ("validation", "test")

PRESETS = {
    "baseline": {"target": "species", "pretrained": False, "epochs": 30, "lr": 3e-4},
    "quick": {"target": "order", "pretrained": True, "epochs": 5, "lr": 1e-3},
}


# ---------------------------------------------------------------------------
# Data loading (no torch import, so it can be unit tested cheaply)
# ---------------------------------------------------------------------------

def label_for(record: dict, target: str) -> str | None:
    """Return the record's label at the requested rank, or None if missing."""
    if target == "species":
        return record.get("taxonLabel") or None
    notes = record.get("notes")
    taxonomy = (json.loads(notes) if isinstance(notes, str) else notes or {}).get("sourceTaxonomy", {})
    value = taxonomy.get(target)
    return value.strip() if isinstance(value, str) and value.strip() else None


def index_images(images_root: Path) -> dict[str, Path]:
    """Map internalImageId (file stem) -> image path."""
    index: dict[str, Path] = {}
    for path in images_root.rglob("*"):
        if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES:
            index[path.stem] = path
    return index


def build_samples(manifest: list[dict], image_index: dict[str, Path], target: str,
                  min_train_per_class: int = 1) -> tuple[dict[str, list[tuple[Path, int]]], list[str]]:
    """Group (path, class index) samples by manifest split.

    Classes come from the training split only; classes with fewer than
    ``min_train_per_class`` training images are dropped, and evaluation
    samples whose label isn't a training class are skipped.
    """
    labelled: list[tuple[str, Path, str]] = []
    for record in manifest:
        path = image_index.get(record.get("internalImageId", ""))
        label = label_for(record, target)
        if path is not None and label is not None:
            labelled.append((record.get("split", ""), path, label))

    train_counts = Counter(label for split, _, label in labelled if split == TRAIN_SPLIT)
    classes = sorted(label for label, n in train_counts.items() if n >= min_train_per_class)
    class_index = {label: i for i, label in enumerate(classes)}

    samples: dict[str, list[tuple[Path, int]]] = {}
    for split, path, label in labelled:
        if label in class_index:
            samples.setdefault(split, []).append((path, class_index[label]))
    return samples, classes


# ---------------------------------------------------------------------------
# Metrics (pure python)
# ---------------------------------------------------------------------------

def macro_f1(confusion: list[list[int]]) -> float:
    n = len(confusion)
    scores = []
    for c in range(n):
        tp = confusion[c][c]
        fp = sum(confusion[r][c] for r in range(n)) - tp
        fn = sum(confusion[c]) - tp
        if tp + fp + fn == 0:
            continue  # class absent from this split and never predicted
        scores.append(2 * tp / (2 * tp + fp + fn))
    return sum(scores) / len(scores) if scores else 0.0


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def make_transforms(input_size):
    from torchvision import transforms

    norm = transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    train_tf = transforms.Compose([
        transforms.RandomResizedCrop(input_size, scale=(0.6, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(0.3, 0.3, 0.3),
        transforms.ToTensor(), norm,
    ])
    eval_tf = transforms.Compose([
        transforms.Resize(input_size), transforms.CenterCrop(input_size),
        transforms.ToTensor(), norm,
    ])
    return train_tf, eval_tf


def make_loaders(samples, input_size, batch_size, workers):
    import torch
    from PIL import Image
    from torch.utils.data import DataLoader, Dataset

    train_tf, eval_tf = make_transforms(input_size)

    class ImageList(Dataset):
        def __init__(self, items, tf):
            self.items, self.tf = items, tf

        def __len__(self):
            return len(self.items)

        def __getitem__(self, i):
            path, label = self.items[i]
            with Image.open(path) as img:
                return self.tf(img.convert("RGB")), label

    def loader(split, tf, shuffle):
        return DataLoader(ImageList(samples.get(split, []), tf), batch_size=batch_size,
                          shuffle=shuffle, num_workers=workers, pin_memory=torch.cuda.is_available(),
                          persistent_workers=workers > 0)

    return loader(TRAIN_SPLIT, train_tf, True), {s: loader(s, eval_tf, False) for s in EVAL_SPLITS}


def evaluate(model, loader, num_classes, device, amp):
    import torch
    confusion = [[0] * num_classes for _ in range(num_classes)]
    total = top1 = top5 = 0
    loss_sum = 0.0
    criterion = torch.nn.CrossEntropyLoss(reduction="sum")
    model.eval()
    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(device, non_blocking=True), labels.to(device, non_blocking=True)
            with torch.autocast(device.type, enabled=amp):
                logits = model(images)
            loss_sum += criterion(logits.float(), labels).item()
            k = min(5, num_classes)
            topk = logits.topk(k, dim=1).indices
            top1 += (topk[:, 0] == labels).sum().item()
            top5 += (topk == labels[:, None]).any(dim=1).sum().item()
            total += labels.numel()
            for t, p in zip(labels.tolist(), topk[:, 0].tolist()):
                confusion[t][p] += 1
    if total == 0:
        return None
    return {
        "images": total,
        "loss": loss_sum / total,
        "top1Accuracy": top1 / total,
        "top5Accuracy": top5 / total,
        "macroF1": macro_f1(confusion),
        "confusionMatrix": confusion,
    }


def train(args) -> int:
    import timm
    import torch

    random.seed(args.seed)
    torch.manual_seed(args.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    amp = device.type == "cuda"
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    print(f"Loading manifest from {args.dataset} …")
    manifest = json.loads((Path(args.dataset) / "manifest.json").read_text(encoding="utf-8"))
    image_index = index_images(Path(args.dataset) / "images")
    samples, classes = build_samples(manifest, image_index, args.target, args.min_train_per_class)
    del manifest
    print(f"{len(classes)} {args.target} classes; "
          + ", ".join(f"{s}={len(v)}" for s, v in sorted(samples.items())))
    if not classes or not samples.get(TRAIN_SPLIT):
        print("No training samples found; check --dataset and --target.")
        return 1
    if args.limit_train:
        random.shuffle(samples[TRAIN_SPLIT])
        samples[TRAIN_SPLIT] = samples[TRAIN_SPLIT][:args.limit_train]

    (out / "labels.json").write_text(json.dumps({"target": args.target, "classes": classes}, indent=2), encoding="utf-8")
    train_loader, eval_loaders = make_loaders(samples, args.input_size, args.batch_size, args.workers)

    model = timm.create_model("efficientnet_b0", pretrained=args.pretrained, num_classes=len(classes)).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    scaler = torch.amp.GradScaler(device.type, enabled=amp)
    criterion = torch.nn.CrossEntropyLoss()

    history, best_loss, stale = [], float("inf"), 0
    for epoch in range(1, args.epochs + 1):
        model.train()
        started, seen, running = time.time(), 0, 0.0
        for step, (images, labels) in enumerate(train_loader, 1):
            images, labels = images.to(device, non_blocking=True), labels.to(device, non_blocking=True)
            optimizer.zero_grad(set_to_none=True)
            with torch.autocast(device.type, enabled=amp):
                loss = criterion(model(images), labels)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            running += loss.item() * labels.numel()
            seen += labels.numel()
            if step % 200 == 0:
                print(f"  epoch {epoch} step {step}/{len(train_loader)} loss {running / seen:.4f}", flush=True)
        scheduler.step()

        val = evaluate(model, eval_loaders[VAL_SPLIT], len(classes), device, amp)
        entry = {"epoch": epoch, "trainLoss": running / max(seen, 1), "seconds": round(time.time() - started)}
        if val:
            entry.update({"valLoss": val["loss"], "valTop1": val["top1Accuracy"], "valTop5": val["top5Accuracy"]})
        history.append(entry)
        (out / "history.json").write_text(json.dumps(history, indent=2), encoding="utf-8")
        print(json.dumps(entry), flush=True)

        val_loss = val["loss"] if val else entry["trainLoss"]
        if val_loss < best_loss:
            best_loss, stale = val_loss, 0
            torch.save({"state_dict": model.state_dict(), "classes": classes, "target": args.target,
                        "inputSize": args.input_size, "architecture": "efficientnet_b0"}, out / "best.pt")
        else:
            stale += 1
            if stale >= args.patience:
                print(f"Early stopping after {epoch} epochs.")
                break

    checkpoint = torch.load(out / "best.pt", map_location=device)
    model.load_state_dict(checkpoint["state_dict"])
    report = {"target": args.target, "classes": len(classes), "pretrained": args.pretrained,
              "epochsRun": len(history), "splits": {}}
    for split, loader in eval_loaders.items():
        result = evaluate(model, loader, len(classes), device, amp)
        if result:
            report["splits"][split] = result
            print(f"{split}: top1 {result['top1Accuracy']:.3f}  top5 {result['top5Accuracy']:.3f}  "
                  f"macroF1 {result['macroF1']:.3f}")
    (out / "report.json").write_text(json.dumps(report), encoding="utf-8")
    print(f"Saved {out / 'best.pt'} and {out / 'report.json'}")
    return 0


def predict(args) -> int:
    import timm
    import torch
    from PIL import Image

    checkpoint = torch.load(args.checkpoint, map_location="cpu")
    classes = checkpoint["classes"]
    model = timm.create_model(checkpoint["architecture"], pretrained=False, num_classes=len(classes))
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    _, eval_tf = make_transforms(checkpoint["inputSize"])
    for path in sorted(Path(args.predict_dir).iterdir()):
        if path.suffix.lower() not in IMAGE_SUFFIXES:
            continue
        with Image.open(path) as img:
            x = eval_tf(img.convert("RGB"))[None]
        with torch.no_grad():
            probs = model(x).softmax(dim=1)[0]
        top = probs.topk(min(3, len(classes)))
        guesses = ", ".join(f"{classes[i]} {p:.0%}" for p, i in zip(top.values.tolist(), top.indices.tolist()))
        print(f"{path.name}: {guesses}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--preset", choices=sorted(PRESETS), default="quick")
    parser.add_argument("--dataset", default=str(DEFAULT_DATASET), help="prepared/ folder with manifest.json")
    parser.add_argument("--target", choices=TAXONOMY_RANKS, help="override the preset's taxonomic rank")
    parser.add_argument("--pretrained", action=argparse.BooleanOptionalAction, default=None,
                        help="override the preset's ImageNet initialisation")
    parser.add_argument("--epochs", type=int)
    parser.add_argument("--lr", type=float)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--weight-decay", type=float, default=0.01)
    parser.add_argument("--input-size", type=int, default=224)
    parser.add_argument("--patience", type=int, default=5)
    parser.add_argument("--min-train-per-class", type=int, default=1)
    parser.add_argument("--limit-train", type=int, default=0, help="use at most N training images (smoke tests)")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", help="output folder (default runs/<preset>-<target>)")
    parser.add_argument("--predict-dir", help="print top-3 predictions for images in this folder")
    parser.add_argument("--checkpoint", help="checkpoint for --predict-dir (default <out>/best.pt)")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    preset = PRESETS[args.preset]
    args.target = args.target or preset["target"]
    args.pretrained = preset["pretrained"] if args.pretrained is None else args.pretrained
    args.epochs = args.epochs or preset["epochs"]
    args.lr = args.lr or preset["lr"]
    args.out = args.out or str(ROOT / "runs" / f"{args.preset}-{args.target}")
    if args.predict_dir:
        args.checkpoint = args.checkpoint or str(Path(args.out) / "best.pt")
        return predict(args)
    return train(args)


if __name__ == "__main__":
    raise SystemExit(main())
