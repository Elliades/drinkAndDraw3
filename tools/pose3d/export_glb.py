"""Offline pose exporter (SMPL parameters + optional GLB).

Runs a Human Mesh Recovery backend (NLF or 4D-Humans) on a set of reference
images and writes one ``<id>.json`` per image containing the SMPL pose
(per-joint 3D rotations -> torsion), shape ``betas`` (-> real proportions) and
the 24 SMPL joints in 3D and normalized 2D. The web app drives its own stick
figure and anatomical rig from this data.

Optionally (``--mesh``) it also writes a normalized posed ``.glb`` for quick
visual inspection; the muscle-study viewer uses the app's own mesh, so the GLB
is off by default.

Inputs (one of):
  --manifest PATH   JSON array of {"id": "...", "url": "..."} or {"id","image"}.
                    "url" is downloaded; "image" is a local path. (Produced by
                    the Node script scripts/pose3d-export-manifest.ts.)
  --images DIR      Directory of images; the file stem becomes the id.

Output:
  <out-dir>/<id>.json              SMPL pose data per processed image
  <out-dir>/<id>.glb               posed mesh (only with --mesh)
  <out-dir>/manifest.json          [{"id","json","glb?","status","error?"}]

Idempotent: existing <id>.json are skipped unless --force.

Examples:
  python export_glb.py --backend nlf --manifest in.json --out-dir out
  python export_glb.py --backend nlf --images ./imgs --out-dir out --mesh
"""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
from typing import Optional

import numpy as np
import requests
import trimesh
from PIL import Image
from tqdm import tqdm

from backends import PersonMesh, load_backend

_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
_TARGET_HEIGHT = 1.75  # scene units (meters-ish) for a consistent default frame
_POSE_SCHEMA_VERSION = 1


def _load_image_rgb(src: str, timeout: float = 30.0) -> np.ndarray:
    if src.startswith("http://") or src.startswith("https://"):
        resp = requests.get(src, timeout=timeout)
        resp.raise_for_status()
        img = Image.open(io.BytesIO(resp.content))
    else:
        img = Image.open(src)
    return np.asarray(img.convert("RGB"))


def _normalize_for_viewer(mesh: PersonMesh) -> trimesh.Trimesh:
    """Camera frame (Y-down, Z-forward) -> Three.js (Y-up), centered, scaled.

    The reference viewer orbits the mesh, so exact camera matching is not needed;
    we just want it upright, roughly facing the camera, centered at the origin,
    and a predictable size.
    """
    v = mesh.vertices.astype(np.float64).copy()

    # HMR backbones output a camera frame with Y pointing down and Z into the
    # scene. Flip Y and Z so the mesh stands up and faces +Z in Three.js.
    v[:, 1] *= -1.0
    v[:, 2] *= -1.0

    # Center on the bounding-box center so OrbitControls' target [0,0,0] frames it.
    bb_min = v.min(axis=0)
    bb_max = v.max(axis=0)
    center = (bb_min + bb_max) * 0.5
    v -= center

    # Scale to a consistent height regardless of the backend's native units (m vs mm).
    height = float(bb_max[1] - bb_min[1])
    if height > 1e-6:
        v *= _TARGET_HEIGHT / height

    tm = trimesh.Trimesh(vertices=v, faces=mesh.faces, process=False)
    tm.visual = trimesh.visual.ColorVisuals(
        mesh=tm, vertex_colors=np.tile([200, 200, 205, 255], (len(v), 1))
    )
    return tm


def _build_pose_data(
    mesh: PersonMesh, backend_name: str, width: int, height: int
) -> Optional[dict]:
    """Serialize SMPL params into the web pose-data JSON schema.

    Returns None when the backend did not provide pose params (so the caller can
    record a clear status instead of writing an empty file).
    """
    if mesh.pose is None or mesh.joints3d is None:
        return None

    pose = np.asarray(mesh.pose, dtype=np.float64).reshape(-1)
    data: dict = {
        "version": _POSE_SCHEMA_VERSION,
        "backend": backend_name,
        "imageWidth": int(width),
        "imageHeight": int(height),
        # SMPL axis-angle, 24 joints x 3 = 72. Local rotations carry axial twist.
        "pose": pose.tolist(),
        # 24 SMPL joints in the backend's native camera frame (Y-down, Z-forward).
        "joints3d": np.asarray(mesh.joints3d, dtype=np.float64).reshape(-1, 3).tolist(),
    }

    if mesh.betas is not None:
        data["betas"] = np.asarray(mesh.betas, dtype=np.float64).reshape(-1).tolist()

    if mesh.joints2d is not None and width > 0 and height > 0:
        j2 = np.asarray(mesh.joints2d, dtype=np.float64).reshape(-1, 2)
        # Normalize pixel coords to [0,1] so the overlay is resolution-agnostic.
        j2[:, 0] /= float(width)
        j2[:, 1] /= float(height)
        data["joints2d"] = j2.tolist()

    return data


def _gather_items(args) -> list[dict]:
    if args.manifest:
        with open(args.manifest, "r", encoding="utf-8") as f:
            items = json.load(f)
        out = []
        for it in items:
            src = it.get("url") or it.get("image")
            if not it.get("id") or not src:
                continue
            out.append({"id": str(it["id"]), "src": src})
        return out
    if args.images:
        out = []
        for name in sorted(os.listdir(args.images)):
            ext = os.path.splitext(name)[1].lower()
            if ext not in _IMAGE_EXTS:
                continue
            out.append(
                {"id": os.path.splitext(name)[0], "src": os.path.join(args.images, name)}
            )
        return out
    raise SystemExit("Provide --manifest or --images.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend", default="nlf", help="nlf | fourdhumans")
    parser.add_argument("--manifest", help="JSON array of {id, url|image}")
    parser.add_argument("--images", help="Directory of images (stem = id)")
    parser.add_argument("--out-dir", default="out", help="Output directory")
    parser.add_argument("--device", default="cuda", help="cuda | cpu")
    parser.add_argument(
        "--force", action="store_true", help="Re-export existing outputs"
    )
    parser.add_argument(
        "--mesh",
        action="store_true",
        help="Also export a normalized posed .glb (off by default)",
    )
    parser.add_argument("--model-path", help="NLF: path to .torchscript")
    parser.add_argument(
        "--smpl-faces-path",
        help="NLF: path to smpl_faces.npy (default: data/smpl_faces.npy)",
    )
    parser.add_argument(
        "--smpl-model-path",
        help="Deprecated (unused); faces come from --smpl-faces-path",
    )
    args = parser.parse_args()

    items = _gather_items(args)
    if not items:
        print("Nothing to process.")
        return 0

    os.makedirs(args.out_dir, exist_ok=True)

    backend_kwargs = {"device": args.device}
    if args.model_path:
        backend_kwargs["model_path"] = args.model_path
    if args.smpl_faces_path:
        backend_kwargs["smpl_faces_path"] = args.smpl_faces_path

    backend = load_backend(args.backend, **backend_kwargs)
    print(f"Loading backend '{backend.name}' ...", flush=True)
    backend.load()

    results: list[dict] = []
    for it in tqdm(items, desc="exporting"):
        rid = it["id"]
        json_path = os.path.join(args.out_dir, f"{rid}.json")
        glb_path = os.path.join(args.out_dir, f"{rid}.glb")
        if os.path.isfile(json_path) and not args.force:
            entry = {"id": rid, "json": f"{rid}.json", "status": "skipped"}
            if args.mesh and os.path.isfile(glb_path):
                entry["glb"] = f"{rid}.glb"
            results.append(entry)
            continue
        try:
            image = _load_image_rgb(it["src"])
            h, w = int(image.shape[0]), int(image.shape[1])
            mesh = backend.infer(image)
            if mesh is None:
                results.append({"id": rid, "status": "no_person"})
                continue

            pose_data = _build_pose_data(mesh, backend.name, w, h)
            if pose_data is None:
                results.append({"id": rid, "status": "no_pose"})
                print(
                    f"  [warn] {rid}: backend returned no SMPL pose params",
                    file=sys.stderr,
                )
                continue
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(pose_data, f)

            entry = {"id": rid, "json": f"{rid}.json", "status": "ok"}
            if args.mesh:
                tm = _normalize_for_viewer(mesh)
                tm.export(glb_path)
                entry["glb"] = f"{rid}.glb"
            results.append(entry)
        except Exception as exc:  # keep the batch going; record the failure
            results.append({"id": rid, "status": "error", "error": str(exc)})
            print(f"  [error] {rid}: {exc}", file=sys.stderr)

    manifest_path = os.path.join(args.out_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    ok = sum(1 for r in results if r["status"] == "ok")
    skipped = sum(1 for r in results if r["status"] == "skipped")
    print(
        f"Done: {ok} exported, {skipped} skipped, "
        f"{len(results) - ok - skipped} failed/none. Manifest: {manifest_path}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
