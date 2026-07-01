"""4D-Humans / HMR2.0 backend.

Repo:   https://github.com/shubham-goel/4D-Humans  (non-commercial model weights)
Why:    Turnkey, very robust on unusual poses. Outputs SMPL params + mesh.

Setup (see ../README.md):
    pip install git+https://github.com/shubham-goel/4D-Humans.git
    # detectron2 (for the ViTDet person detector) per its install docs
    # Checkpoints + SMPL are fetched on first run by the hmr2 package.

This wraps the same building blocks the official ``demo.py`` uses: a ViTDet
person detector to get boxes, then HMR2.0 to regress the mesh per box.
"""

from __future__ import annotations

from typing import Optional

import numpy as np

from .base import HmrBackend, PersonMesh


class FourDHumansBackend(HmrBackend):
    name = "fourdhumans"

    def __init__(self, device: str = "cuda") -> None:
        self.device = device
        self._model = None
        self._detector = None
        self._faces: Optional[np.ndarray] = None

    def load(self) -> None:
        import torch
        from hmr2.models import DEFAULT_CHECKPOINT, load_hmr2

        model, _ = load_hmr2(DEFAULT_CHECKPOINT)
        self._model = model.to(self.device).eval()
        self._faces = np.asarray(self._model.smpl.faces, dtype=np.int64)
        self._detector = self._build_detector()
        self._torch = torch

    def _build_detector(self):
        # ViTDet person detector, mirroring 4D-Humans demo.py.
        from detectron2.config import LazyConfig
        from hmr2.utils.utils_detectron2 import DefaultPredictor_Lazy
        import hmr2

        cfg_path = (
            f"{list(hmr2.__path__)[0]}/configs/cascade_mask_rcnn_vitdet_h_75ep.py"
        )
        detectron2_cfg = LazyConfig.load(str(cfg_path))
        detectron2_cfg.train.init_checkpoint = (
            "https://dl.fbaipublicfiles.com/detectron2/ViTDet/COCO/"
            "cascade_mask_rcnn_vitdet_h/f328730692/model_final_f05665.pkl"
        )
        for i in range(3):
            detectron2_cfg.model.roi_heads.box_predictors[i].test_score_thresh = 0.25
        return DefaultPredictor_Lazy(detectron2_cfg)

    def infer(self, image_rgb: np.ndarray) -> Optional[PersonMesh]:
        from hmr2.datasets.vitdet_dataset import ViTDetDataset

        torch = self._torch
        assert self._model is not None and self._detector is not None

        # detectron2 predictor expects BGR.
        image_bgr = image_rgb[:, :, ::-1].copy()
        det = self._detector(image_bgr)
        instances = det["instances"]
        person = instances[instances.pred_classes == 0]
        if len(person) == 0:
            return None
        boxes = person.pred_boxes.tensor.cpu().numpy()
        scores = person.scores.cpu().numpy()

        dataset = ViTDetDataset(self._model.cfg, image_bgr, boxes)
        loader = torch.utils.data.DataLoader(dataset, batch_size=len(boxes), shuffle=False)

        best: Optional[PersonMesh] = None
        best_score = -1.0
        for batch in loader:
            batch = {
                k: (v.to(self.device) if hasattr(v, "to") else v)
                for k, v in batch.items()
            }
            with torch.inference_mode():
                out = self._model(batch)
            verts = out["pred_vertices"].detach().cpu().numpy()  # (B, 6890, 3)
            for i in range(verts.shape[0]):
                s = float(scores[i]) if i < len(scores) else 1.0
                if s > best_score:
                    best_score = s
                    best = PersonMesh(
                        vertices=verts[i].astype(np.float32),
                        faces=self._faces,
                        score=s,
                    )
        return best
