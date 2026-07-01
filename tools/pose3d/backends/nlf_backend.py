"""NLF (Neural Localizer Fields, NeurIPS 2024) backend.

Repo:   https://github.com/isarandi/nlf  (MIT code; non-commercial model weights)
Model:  nlf_l_multi_0.3.2.torchscript from Releases (or bit.ly/nlf_l_pt)

Setup (see ../README.md):
    1. Download TorchScript weights into tools/pose3d/weights/nlf_l_multi.torchscript
    2. SMPL face topology is in tools/pose3d/data/smpl_faces.npy (public HMR helper file)
"""

from __future__ import annotations

import os
from typing import Optional

import numpy as np

from .base import HmrBackend, PersonMesh

_DEFAULT_MODEL = os.path.join("weights", "nlf_l_multi.torchscript")
_DEFAULT_FACES = os.path.join("data", "smpl_faces.npy")
_SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _resolve(path: str) -> str:
    if os.path.isabs(path):
        return path
    return os.path.join(_SCRIPT_DIR, path)


def _load_smpl_faces(faces_path: str) -> np.ndarray:
    faces = np.load(faces_path)
    return np.asarray(faces, dtype=np.int64)


class NlfBackend(HmrBackend):
    name = "nlf"

    def __init__(
        self,
        model_path: str = _DEFAULT_MODEL,
        smpl_faces_path: str = _DEFAULT_FACES,
        smpl_model_path: str | None = None,
        device: str = "cuda",
    ) -> None:
        # smpl_model_path kept for CLI compatibility; faces come from smpl_faces.npy.
        self.model_path = _resolve(model_path)
        self.smpl_faces_path = _resolve(smpl_faces_path)
        if smpl_model_path:
            _ = smpl_model_path  # unused
        self.device = device
        self._model = None
        self._faces: Optional[np.ndarray] = None

    def load(self) -> None:
        import torch
        import torchvision  # required for NLF TorchScript load

        _ = torchvision  # noqa: F841

        if not os.path.isfile(self.model_path):
            raise FileNotFoundError(
                f"NLF TorchScript model not found at '{self.model_path}'. "
                "Download from https://github.com/isarandi/nlf/releases "
                "(nlf_l_multi_0.3.2.torchscript)."
            )
        if not os.path.isfile(self.smpl_faces_path):
            raise FileNotFoundError(
                f"SMPL faces not found at '{self.smpl_faces_path}'. "
                "See tools/pose3d/README.md (data/smpl_faces.npy)."
            )
        self._model = torch.jit.load(self.model_path).to(self.device).eval()
        self._faces = _load_smpl_faces(self.smpl_faces_path)

    def infer(self, image_rgb: np.ndarray) -> Optional[PersonMesh]:
        import torch

        assert self._model is not None and self._faces is not None, "call load() first"

        chw = np.ascontiguousarray(np.transpose(image_rgb, (2, 0, 1)))
        image = torch.from_numpy(chw).to(self.device)

        with torch.inference_mode():
            pred = self._model.detect_smpl_batched(image.unsqueeze(0))

        # Each pred[key] is a per-batch-image list; index [0] holds this image's
        # results. For one image that is a (n_persons, ...) tensor (or, in some
        # builds, a list of per-person tensors). Normalize to a list per person.
        def _batch_people(key: str) -> list:
            if key not in pred:
                return []
            batch0 = pred[key][0]
            if hasattr(batch0, "detach"):
                arr = batch0.detach().cpu().numpy()
                # (n, ...) -> list of n arrays.
                return [np.asarray(a) for a in arr]
            return [np.asarray(a) for a in list(batch0)]

        verts_np = _batch_people("vertices3d")
        if len(verts_np) == 0:
            return None

        pose_np = _batch_people("pose")
        betas_np = _batch_people("betas")
        joints3d_np = _batch_people("joints3d")
        joints2d_np = _batch_people("joints2d")

        def height(v: np.ndarray) -> float:
            return float(v[:, 1].max() - v[:, 1].min())

        # Pick the tallest person (the main subject) and return all params for it.
        idx = int(max(range(len(verts_np)), key=lambda i: height(verts_np[i])))

        def _pick(arrs: list, i: int) -> Optional[np.ndarray]:
            if i < len(arrs):
                return np.asarray(arrs[i], dtype=np.float32)
            return None

        return PersonMesh(
            vertices=verts_np[idx].astype(np.float32),
            faces=self._faces,
            pose=_pick(pose_np, idx),
            betas=_pick(betas_np, idx),
            joints3d=_pick(joints3d_np, idx),
            joints2d=_pick(joints2d_np, idx),
        )
