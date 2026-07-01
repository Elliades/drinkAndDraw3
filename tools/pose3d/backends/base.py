"""Backend interface + factory."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np


@dataclass
class PersonMesh:
    """A single recovered body mesh + SMPL parameters.

    Attributes:
        vertices: (V, 3) float32 array in the backend's native frame (meters or mm).
        faces: (F, 3) int array of triangle vertex indices.
        score: optional detection/confidence score (used to pick the main subject).
        pose: (72,) SMPL axis-angle pose (24 joints x 3), if the backend exposes it.
        betas: (10,) SMPL shape coefficients, if available.
        joints3d: (24, 3) SMPL joint positions in the backend's native frame.
        joints2d: (24, 2) SMPL joints projected to image pixels (origin top-left).
    """

    vertices: np.ndarray
    faces: np.ndarray
    score: float = 1.0
    pose: Optional[np.ndarray] = None
    betas: Optional[np.ndarray] = None
    joints3d: Optional[np.ndarray] = None
    joints2d: Optional[np.ndarray] = None


class HmrBackend:
    """Base class for Human Mesh Recovery backends."""

    name: str = "base"

    def load(self) -> None:
        """Load model weights into memory (called once)."""
        raise NotImplementedError

    def infer(self, image_rgb: np.ndarray) -> Optional[PersonMesh]:
        """Run on a single HxWx3 uint8 RGB image.

        Returns the largest / most-confident person mesh, or ``None`` if no
        person was detected.
        """
        raise NotImplementedError


def load_backend(name: str, **kwargs) -> HmrBackend:
    """Instantiate a backend by name.

    Supported: ``"nlf"`` (recommended, best proportions) and
    ``"fourdhumans"`` (a.k.a. ``"4dhumans"`` / ``"hmr2"``).
    """
    key = name.lower().replace("-", "").replace("_", "")
    if key == "nlf":
        from .nlf_backend import NlfBackend

        return NlfBackend(**kwargs)
    if key in {"fourdhumans", "4dhumans", "hmr2", "hmr20"}:
        from .fourdhumans_backend import FourDHumansBackend

        return FourDHumansBackend(**kwargs)
    raise ValueError(f"Unknown backend '{name}'. Use 'nlf' or 'fourdhumans'.")
