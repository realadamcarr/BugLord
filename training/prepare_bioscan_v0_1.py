"""Acquire and prepare the rights-reviewed BIOSCAN v0.1 dataset.

The command intentionally requires callers to supply upstream URLs and expected
SHA-256 values.  BIOSCAN's large Google Drive packages do not have immutable
URLs in BugLord's source-of-truth documents, so silently embedding one would
make acquisition neither auditable nor reproducible.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import csv
import hashlib
from importlib.metadata import PackageNotFoundError, version
import json
import os
import shutil
import sys
import zipfile
import struct
import zlib
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter
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


def hub_download(repo_id: str, filename: str, revision: str, destination: Path,
                 expected_sha256: str, expected_bytes: int | None = None,
                 force_download: bool = False) -> dict[str, object]:
    """Download one revision-pinned Hub asset with Xet and verify it."""
    if len(expected_sha256) != 64:
        raise PipelineError("expected SHA-256 must contain 64 hexadecimal characters")
    if not revision:
        raise PipelineError("a pinned Hugging Face revision is required")
    if destination.name != Path(filename).name:
        raise PipelineError("output filename must match the Hugging Face asset filename")
    try:
        from huggingface_hub import hf_hub_download
    except ImportError as error:
        raise PipelineError(
            "huggingface_hub is required; install training/requirements.txt"
        ) from error

    destination.parent.mkdir(parents=True, exist_ok=True)
    started = perf_counter()
    try:
        downloaded = Path(hf_hub_download(
            repo_id=repo_id, repo_type="dataset", filename=filename,
            revision=revision, local_dir=destination.parent,
            force_download=force_download,
        ))
        if downloaded.resolve() != destination.resolve():
            raise PipelineError(
                f"Hub asset path {filename!r} does not resolve to output {destination}"
            )
        elapsed = perf_counter() - started
        if expected_bytes is not None and destination.stat().st_size != expected_bytes:
            raise PipelineError(
                f"size mismatch for {filename}: expected {expected_bytes}, "
                f"got {destination.stat().st_size}"
            )
        actual = sha256_file(destination)
        if actual.lower() != expected_sha256.lower():
            raise PipelineError(
                f"checksum mismatch for {filename}: expected {expected_sha256}, got {actual}"
            )
    except PipelineError:
        raise
    size = destination.stat().st_size
    try:
        xet_version = version("hf-xet")
    except PackageNotFoundError:
        xet_version = None
    return {
        "repoId": repo_id, "repoType": "dataset", "revision": revision,
        "filename": filename, "path": str(destination),
        "sha256": expected_sha256.lower(), "bytes": size,
        "transfer": {
            "backend": "huggingface_hub/hf_xet", "forced": force_download,
            "huggingfaceHubVersion": version("huggingface-hub"),
            "hfXetVersion": xet_version,
            "highPerformance": os.environ.get("HF_XET_HIGH_PERFORMANCE", "").upper()
            in {"1", "ON", "YES", "TRUE"},
            "elapsedSeconds": round(elapsed, 6),
            "mebibytesPerSecond": round(size / (1024 * 1024) / elapsed, 3) if elapsed else None,
        },
    }


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


def eligible_process_ids(metadata: Path, selected_splits: set[str]) -> set[str]:
    """Return exactly the labelled identifiers in the requested official splits."""
    result: set[str] = set()
    with metadata.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        required = {"processid", "species", "split"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise PipelineError(f"metadata is missing required columns: {sorted(required)}")
        for row in reader:
            if (first_value(row, "split") in selected_splits
                    and first_value(row, "species") and first_value(row, "processid")):
                result.add(first_value(row, "processid").casefold())
    return result


def selective_extract(archive: Path, destination: Path, process_ids: set[str]) -> dict[str, int]:
    """Safely extract only requested images from a BIOSCAN ZIP."""
    destination.mkdir(parents=True, exist_ok=True)
    root = destination.resolve()
    extracted = skipped = 0
    with zipfile.ZipFile(archive) as source:
        for member in source.infolist():
            target = (destination / member.filename).resolve()
            if target != root and root not in target.parents:
                raise PipelineError(f"unsafe ZIP member in {archive}: {member.filename}")
            if member.is_dir() or Path(member.filename).suffix.lower() not in IMAGE_SUFFIXES:
                skipped += 1
                continue
            if Path(member.filename).stem.casefold() not in process_ids:
                skipped += 1
                continue
            source.extract(member, destination)
            extracted += 1
    return {"extracted": extracted, "skipped": skipped}


def load_candidate(path: Path) -> dict:
    candidate = load_json(path)
    controls = candidate.get("controls", {})
    source = candidate.get("source", {})
    if not controls.get("downloadAuthorized") or not controls.get("trainingAuthorized"):
        raise PipelineError("candidate does not authorize acquisition and training")
    if source.get("name") != "BIOSCAN-5M" or source.get("imagePackage") != "BIOSCAN_5M_cropped_256":
        raise PipelineError("candidate must select BIOSCAN-5M cropped_256 images")
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
        "modifications": [
            "Upstream BIOSCAN crop and resize to 256 pixels on the shorter side",
            "Copied without further pixel modification into canonical split layout",
        ],
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


def generate_eligibility_report(metadata: Path, candidate_path: Path,
                                metadata_url: str | None = None) -> dict[str, object]:
    """Summarize eligibility using metadata only; never inspect image assets."""
    candidate = load_candidate(candidate_path)
    split_counts: Counter[str] = Counter()
    eligible_counts: Counter[str] = Counter()
    rejection_counts: Counter[str] = Counter()
    species_by_split: dict[str, set[str]] = defaultdict(set)
    total = 0

    with metadata.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        required = {"processid", "species", "split"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise PipelineError(f"metadata is missing required columns: {sorted(required)}")
        for row in reader:
            total += 1
            source_split = first_value(row, "split")
            process_id = first_value(row, "processid")
            species = first_value(row, "species")
            split_counts[source_split or "<missing>"] += 1
            if source_split not in ALLOWED_SOURCE_SPLITS:
                rejection_counts["missing-or-unsupported-split"] += 1
            elif not process_id:
                rejection_counts["missing-processid"] += 1
            elif not species:
                rejection_counts["missing-species"] += 1
            else:
                eligible_counts[source_split] += 1
                species_by_split[source_split].add(species)

    supervised = {"train", "val", "test"}
    eligible_supervised = sum(eligible_counts[split] for split in supervised)
    report = {
        "reportType": "bioscan-v0.1-metadata-eligibility",
        "datasetVersion": candidate["datasetVersion"].removesuffix("-candidate"),
        "metadata": {
            "filename": metadata.name,
            "sourceUrl": metadata_url,
            "sha256": sha256_file(metadata),
            "bytes": metadata.stat().st_size,
            "rows": total,
        },
        "policy": {
            "requiredFields": ["processid", "species", "split"],
            "allowedSourceSplits": sorted(ALLOWED_SOURCE_SPLITS),
            "baselineSourceSplits": sorted(supervised),
            "imageValidationPerformed": False,
            "trainingStarted": False,
        },
        "countsBySourceSplit": dict(sorted(split_counts.items())),
        "eligibleBySourceSplit": dict(sorted(eligible_counts.items())),
        "distinctEligibleSpeciesBySourceSplit": {
            split: len(species) for split, species in sorted(species_by_split.items())
        },
        "ineligibleByReason": dict(sorted(rejection_counts.items())),
        "eligibleBaselineRows": eligible_supervised,
        "eligibleAllAllowedSplitRows": sum(eligible_counts.values()),
        "decision": "eligible-for-image-acquisition-review" if eligible_supervised else "not-eligible",
        "limitations": [
            "Metadata eligibility does not establish that corresponding images are present or valid.",
            "Image checksums, duplicate pixels, and cross-split image leakage require the image archives.",
            "This report does not approve image acquisition or start model training.",
        ],
    }
    return report


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
    acquire = subcommands.add_parser(
        "acquire", help="download one checksum-pinned Hugging Face dataset asset via Xet")
    acquire.add_argument("--repo-id", default="bioscan-ml/BIOSCAN-5M")
    acquire.add_argument("--filename", required=True)
    acquire.add_argument("--revision", required=True)
    acquire.add_argument("--sha256", required=True)
    acquire.add_argument("--output", type=Path, required=True)
    acquire.add_argument("--bytes", type=int, default=None)
    acquire.add_argument("--force-download", action="store_true")
    acquire.add_argument("--benchmark-output", type=Path)
    acquire.add_argument("--candidate", type=Path, default=DEFAULT_CANDIDATE)
    extract = subcommands.add_parser("extract", help="safely extract a verified BIOSCAN ZIP")
    extract.add_argument("archive", type=Path)
    extract.add_argument("--output", type=Path, required=True)
    extract.add_argument("--metadata", type=Path)
    extract.add_argument("--splits", default="train,val,test")
    prep = subcommands.add_parser("prepare", help="validate images and create the training layout")
    prep.add_argument("--metadata", type=Path, required=True)
    prep.add_argument("--images", type=Path, required=True)
    prep.add_argument("--output", type=Path, required=True)
    prep.add_argument("--candidate", type=Path, default=DEFAULT_CANDIDATE)
    prep.add_argument("--splits", default="train,val,test")
    prep.add_argument("--retrieved-at", default=None)
    prep.add_argument("--manifest-only", action="store_true")
    eligibility = subcommands.add_parser(
        "eligibility-report", help="create an eligibility report from metadata only")
    eligibility.add_argument("--metadata", type=Path, required=True)
    eligibility.add_argument("--output", type=Path, required=True)
    eligibility.add_argument("--metadata-url")
    eligibility.add_argument("--candidate", type=Path, default=DEFAULT_CANDIDATE)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "acquire":
            load_candidate(args.candidate)
            receipt = hub_download(
                args.repo_id, args.filename, args.revision, args.output,
                args.sha256, args.bytes, args.force_download)
            receipt["retrievedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            if args.benchmark_output:
                args.benchmark_output.parent.mkdir(parents=True, exist_ok=True)
                args.benchmark_output.write_text(
                    json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
            print(json.dumps(receipt, indent=2))
        elif args.command == "extract":
            if args.metadata:
                selected = set(filter(None, args.splits.split(",")))
                unknown = selected - ALLOWED_SOURCE_SPLITS
                if unknown:
                    raise PipelineError(f"unsupported BIOSCAN split(s): {', '.join(sorted(unknown))}")
                print(json.dumps(selective_extract(
                    args.archive, args.output, eligible_process_ids(args.metadata, selected)), indent=2))
            else:
                safe_extract(args.archive, args.output)
        elif args.command == "prepare":
            timestamp = args.retrieved_at or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            result = prepare(args.metadata, args.images, args.output, args.candidate,
                             set(filter(None, args.splits.split(","))), timestamp,
                             not args.manifest_only)
            print(f"Prepared {len(result.records)} images; rejected {result.report['rejected']}.")
        else:
            report = generate_eligibility_report(
                args.metadata, args.candidate, args.metadata_url)
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
            print(f"Reported {report['eligibleBaselineRows']} eligible baseline rows.")
        return 0
    except (OSError, json.JSONDecodeError, PipelineError, zipfile.BadZipFile) as error:
        print(f"BIOSCAN pipeline failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
