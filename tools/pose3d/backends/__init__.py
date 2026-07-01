"""Pluggable Human Mesh Recovery backends.

Each backend turns a single RGB image into a posed body mesh (vertices + faces).
The vertices are returned in the model's native coordinate frame; orientation /
scaling normalization for the web viewer happens in ``export_glb.py``.
"""

from .base import HmrBackend, PersonMesh, load_backend

__all__ = ["HmrBackend", "PersonMesh", "load_backend"]
