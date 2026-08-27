"""Acquire and prepare the rights-reviewed BIOSCAN v0.1 dataset.

The command intentionally requires callers to supply upstream URLs and expected
SHA-256 values.  BIOSCAN's large Google Drive packages do not have immutable
URLs in BugLord's source-of-truth documents, so silently embedding one would
make acquisition neither auditable nor reproducible.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import shutil
import sys
import urllib.request
import zipfile
import struct
import zlib
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Sequence

from validate_dataset_manifest import DEFAULT_SCHEMA_PATH, load_json, validate_manifest


ROOT = Path(__file__).resolve().parent
DEFAULT_CANDIDATE = ROOT / "datasets" / "buglord-bioscan-v0.1.0-candidate.json"
ALLOWED_SOURCE_SPLITS = {
    "train", "val", "test", "key_unseen", "val_unseen", "test_unseen",
    "other_heldout", "pretrain",
}
MANIFEST_SPLITS = {
    "train": "train",
    "val": "validation",
    "test": "test",
    "key_unseen": "benchmark",
    "val_unseen": "benchmark",
    "test_unseen": "benchmark",
    "other_heldout": "quarantine",
    "pretrain": "quarantine",
}
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


class PipelineError(Exception):
    """An expected, user-actionable pipeline failure."""


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, destination: Path, expected_sha256: str) -> dict[str, object]:
    """Download one pinned asset atomically and verify it before promotion."""
    if len(expected_sha256) != 64:
        raise PipelineError("expected SHA-256 must contain 64 hexadecimal characters")
    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_name(destination.name + ".partial")
    try:
        with urllib.request.urlopen(url) as response, partial.open("wb") as target:
            shutil.copyfileobj(response, target)
        actual = sha256_file(partial)
        if actual.lower() != expected_sha256.lower():
            raise PipelineError(
                f"checksum mismatch for {url}: expected {expected_sha256}, got {actual}"
            )
        partial.replace(destination)
    finally:
        if partial.exists():
            partial.unlink()
    return {"url": url, "path": destination.name, "sha256": expected_sha256.lower(),
            "bytes": destination.stat().st_size}


def safe_extract(archive: Path, destination: Path) -> None:
    """Extract a ZIP while rejecting traversal and absolute member paths."""
    destination.mkdir(parents=True, exist_ok=True)
    root = destination.resolve()
    with zipfile.ZipFile(archive) as source:
        for member in source.infolist():
            target = (destination / member.filename).resolve()
            if target != root and root not in target.parents:
                raise PipelineError(f"unsafe ZIP member in {archive}: {member.filename}")
        source.extractall(destination)


def load_candidate(path: Path) -> dict:
    candidate = load_json(path)
    controls = candidate.get("controls", {})
    source = candidate.get("source", {})
    if not controls.get("downloadAuthorized") or not controls.get("trainingAuthorized"):
        raise PipelineError("candidate does not authorize acquisition and training")
    if source.get("name") != "BIOSCAN-5M" or source.get("imagePackage") != "BIOSCAN_5M_original_full":
        raise PipelineError("candidate must select BIOSCAN-5M original full-resolution images")
    return candidate


def image_index(images_root: Path) -> dict[str, Path]:
    result: dict[str, Path] = {}
    ambiguous: set[str] = set()
    for path in sorted(images_root.rglob("*")):
        if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES:
            key = path.stem.casefold()
            if key in result:
                ambiguous.add(key)
            else:
                result[key] = path
    for key in ambiguous:
        del result[key]
    return result


def first_value(row: dict[str, str], *names: str) -> str:
    for name in names:
        value = (row.get(name) or "").strip()
        if value:
            return value
    return ""


def verify_image(path: Path) -> None:
    """Perform dependency-free structural checks for supported image containers."""
    data = path.read_bytes()
    suffix = path.suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        valid = len(data) >= 4 and data[:2] == b"\xff\xd8" and data[-2:] == b"\xff\xd9"
    elif suffix == ".png":
        valid = _valid_png(data)
    elif suffix == ".webp":
        valid = (len(data) >= 20 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
                 and struct.unpack("<I", data[4:8])[0] + 8 == len(data))
    else:
        valid = False
    if not valid:
        raise PipelineError("unsupported or structurally invalid image")


def _valid_png(data: bytes) -> bool:
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        return False
    offset = 8
    saw_header = saw_data = saw_end = False
    while offset + 12 <= len(data):
        length = struct.unpack(">I", data[offset:offset + 4])[0]
        end = offset + 12 + length
        if end > len(data):
            return False
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + length]
        expected_crc = struct.unpack(">I", data[offset + 8 + length:end])[0]
        if zlib.crc32(kind + payload) & 0xFFFFFFFF != expected_crc:
            return False
        if kind == b"IHDR":
            saw_header = length == 13 and not saw_header
        elif kind == b"IDAT":
            saw_data = True
        elif kind == b"IEND":
            saw_end = length == 0
            return saw_header and saw_data and saw_end and end == len(data)
        offset = end
    return False


def manifest_record(row: dict[str, str], image_id: str, digest: str,
                    source_split: str, retrieved_at: str, candidate: dict) -> dict:
    rights = candidate["rights"]
    taxon = first_value(row, "species")
    source_identifier = first_value(row, "processid")
    notes = {
        "sourceSplit": source_split,
        "sourceTaxonomy": {rank: row.get(rank) or None for rank in candidate["taxonomy"]["sourceFields"]},
        "modifications": ["Copied without pixel modification into canonical split layout"],
    }
    return {
        "internalImageId": image_id,
        "source": candidate["source"]["name"],
        "sourceIdentifier": source_identifier,
        "creator": rights["copyrightHolder"],
        "license": rights["license"],
        "licenseUrl": rights["licenseUrl"],
        "licenseVersion": rights["licenseVersion"],
        "attributionText": rights["attribution"],
        "retrievedAt": retrieved_at,
        "taxonLabel": taxon,
        "taxonomicId": first_value(row, "taxon") or None,
        "split": MANIFEST_SPLITS[source_split],
        "sha256": digest,
        "commercialMlUseVerified": True,
        "rightsReviewStatus": "approved",
        "rightsReviewer": "BugLord BIOSCAN-5M commercial rights review BL-AUTO-F5BA623B",
        "rightsReviewedAt": "2026-08-27T00:00:00Z",
        "originContainsINaturalistData": False,
        "notes": json.dumps(notes, sort_keys=True, separators=(",", ":")),
    }


@dataclass
class PreparationResult:
    records: list[dict]
    report: dict[str, object]


def prepare(metadata: Path, images_root: Path, output: Path, candidate_path: Path,
            selected_splits: set[str], retrieved_at: str, copy_images: bool = True) -> PreparationResult:
    candidate = load_candidate(candidate_path)
    unknown = selected_splits - ALLOWED_SOURCE_SPLITS
    if unknown:
        raise PipelineError(f"unsupported BIOSCAN split(s): {', '.join(sorted(unknown))}")
    images = image_index(images_root)
    records: list[dict] = []
    issues: list[dict[str, str]] = []
    digest_split: dict[str, str] = {}
    counts: dict[str, int] = {}
    output.mkdir(parents=True, exist_ok=True)

    with metadata.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        required = {"processid", "species", "split"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise PipelineError(f"metadata is missing required columns: {sorted(required)}")
        for row_number, row in enumerate(reader, start=2):
            source_split = first_value(row, "split")
            if source_split not in selected_splits:
                continue
            process_id = first_value(row, "processid")
            species = first_value(row, "species")
            if not process_id or not species:
                issues.append({"row": str(row_number), "processid": process_id,
                               "reason": "missing processid or species"})
                continue
            image = images.get(process_id.casefold())
            if image is None:
                issues.append({"row": str(row_number), "processid": process_id,
                               "reason": "missing or ambiguous image"})
                continue
            try:
                verify_image(image)
            except PipelineError as error:
                issues.append({"row": str(row_number), "processid": process_id,
                               "reason": f"invalid image: {error}"})
                continue
            digest = sha256_file(image)
            prior_split = digest_split.get(digest)
            if prior_split is not None:
                reason = "duplicate image" if prior_split == source_split else f"cross-split duplicate (also {prior_split})"
                issues.append({"row": str(row_number), "processid": process_id, "reason": reason})
                continue
            digest_split[digest] = source_split
            internal_id = f"bioscan5m-{process_id}"
            record = manifest_record(row, internal_id, digest, source_split, retrieved_at, candidate)
            records.append(record)
            counts[source_split] = counts.get(source_split, 0) + 1
            if copy_images:
                label = hashlib.sha256(species.encode("utf-8")).hexdigest()[:16]
                destination = output / "images" / source_split / label / f"{internal_id}{image.suffix.lower()}"
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(image, destination)

    violations = validate_manifest(records, load_json(DEFAULT_SCHEMA_PATH))
    if violations:
        raise PipelineError("generated manifest failed validation: " + "; ".join(violations[:5]))
    report = {"datasetVersion": candidate["datasetVersion"].removesuffix("-candidate"),
              "selectedSourceSplits": sorted(selected_splits), "accepted": len(records),
              "countsBySourceSplit": counts, "rejected": len(issues), "issues": issues}
    (output / "manifest.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
    (output / "preparation-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return PreparationResult(records, report)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subcommands = parser.add_subparsers(dest="command", required=True)
    acquire = subcommands.add_parser("acquire", help="download one checksum-pinned upstream asset")
    acquire.add_argument("--url", required=True)
    acquire.add_argument("--sha256", required=True)
    acquire.add_argument("--output", type=Path, required=True)
    acquire.add_argument("--candidate", type=Path, default=DEFAULT_CANDIDATE)
    extract = subcommands.add_parser("extract", help="safely extract a verified BIOSCAN ZIP")
    extract.add_argument("archive", type=Path)
    extract.add_argument("--output", type=Path, required=True)
    prep = subcommands.add_parser("prepare", help="validate images and create the training layout")
    prep.add_argument("--metadata", type=Path, required=True)
    prep.add_argument("--images", type=Path, required=True)
    prep.add_argument("--output", type=Path, required=True)
    prep.add_argument("--candidate", type=Path, default=DEFAULT_CANDIDATE)
    prep.add_argument("--splits", default="train,val,test")
    prep.add_argument("--retrieved-at", default=None)
    prep.add_argument("--manifest-only", action="store_true")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "acquire":
            load_candidate(args.candidate)
            receipt = download(args.url, args.output, args.sha256)
            receipt["retrievedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            print(json.dumps(receipt, indent=2))
        elif args.command == "extract":
            safe_extract(args.archive, args.output)
        else:
            timestamp = args.retrieved_at or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            result = prepare(args.metadata, args.images, args.output, args.candidate,
                             set(filter(None, args.splits.split(","))), timestamp,
                             not args.manifest_only)
            print(f"Prepared {len(result.records)} images; rejected {result.report['rejected']}.")
        return 0
    except (OSError, json.JSONDecodeError, PipelineError, zipfile.BadZipFile) as error:
        print(f"BIOSCAN pipeline failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
