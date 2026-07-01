# pose3d — offline Human Mesh Recovery -> GLB

Generates accurate, per-person 3D body meshes from reference images **offline**
(on a CUDA GPU such as your RTX 3080 Ti), bakes proportions + limb torsion into
the mesh, and exports one `.glb` per image. The web app loads these directly in
the "3D anatomy" view, with the live MediaPipe path as a fallback.

This directory is **not** part of the Next.js build. It's a standalone Python
tool you run when you add/curate references.

## Why this exists

MediaPipe gives 33 point landmarks. Two points define a bone direction but never
its axial twist, and the displayed mesh is a fixed template uniformly scaled — so
torso torsion and per-person proportions can't be recovered at runtime.
Parametric HMR (SMPL) regresses full per-joint rotations (torsion) + shape
(proportions) + a body mesh, which we precompute here.

## Install

```bash
cd tools/pose3d
python -m venv .venv && . .venv/Scripts/activate    # Windows PowerShell: .venv\Scripts\Activate.ps1
# 1) PyTorch matching your CUDA (example: CUDA 12.1)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
# 2) Core deps
pip install -r requirements.txt
```

Then install **one** backend.

### Backend A — NLF (recommended: best proportions)

- Repo: https://github.com/isarandi/nlf (MIT code; non-commercial model weights)
- Download a TorchScript model from the repo Releases into `tools/pose3d/weights/`:
  [nlf_l_multi_0.3.2.torchscript](https://github.com/isarandi/nlf/releases/download/v0.3.2/nlf_l_multi_0.3.2.torchscript)
  (save as `weights/nlf_l_multi.torchscript`).
- SMPL triangle topology: `data/smpl_faces.npy` (included in repo; from the public
  HMR helper file). No SMPL `.pkl` registration required for export.

### Backend B — 4D-Humans / HMR2.0 (easiest to stand up)

- Repo: https://github.com/shubham-goel/4D-Humans (non-commercial weights)

```bash
pip install git+https://github.com/shubham-goel/4D-Humans.git
# detectron2 (ViTDet detector) per https://detectron2.readthedocs.io/tutorials/install.html
```

Checkpoints + SMPL are downloaded by the `hmr2` package on first run.

## Verify a single image (todo: select-model)

```bash
# NLF
python export_glb.py --backend nlf --images ./sample --out-dir ./out \
  --model-path weights/nlf_l_multi.torchscript \
  --smpl-model-path models/basicmodel_neutral_lbs_10_207_0_v1.1.0.pkl

# or 4D-Humans
python export_glb.py --backend fourdhumans --images ./sample --out-dir ./out
```

Open `out/<name>.glb` in any glTF viewer to confirm the pose looks right.

## Batch over the library (todo: offline-tool + glue-scripts)

The Node glue scripts (in `tools/scripts/`, run from the repo root) connect this
to the app DB + storage:

```bash
# 1) Export a manifest of references missing a precomputed mesh
npm run pose3d:manifest -- --out tools/pose3d/in.json

# 2) Generate GLBs on the GPU box
cd tools/pose3d
python export_glb.py --backend nlf --manifest in.json --out-dir out \
  --model-path weights/nlf_l_multi.torchscript \
  --smpl-model-path models/basicmodel_neutral_lbs_10_207_0_v1.1.0.pkl
cd ../..

# 3) Upload GLBs to storage and set Reference.poseMeshKey
npm run pose3d:import -- --dir tools/pose3d/out
```

All steps are idempotent: re-running only processes references that don't yet
have a mesh (use `--force` on `export_glb.py` to regenerate).

## Output coordinate convention

`export_glb.py` normalizes each mesh to Three.js conventions: Y-up, centered at
the origin (so `OrbitControls` target `[0,0,0]` frames it), scaled to ~1.75
units tall. The predicted global orientation is preserved so the mesh roughly
faces the camera like the photo.

## License note

NLF and 4D-Humans **model weights** are for non-commercial research use, and the
SMPL body model is non-commercial (commercial use requires a Meshcapade license).
This pipeline is intended for the non-commercial use of Drink & Draw.
