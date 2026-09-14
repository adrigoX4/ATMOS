import xarray as xr
import json
import logging
import shutil
from pathlib import Path
from typing import Dict, List

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class StorageService:
    """Local filesystem storage using NetCDF format."""

    def __init__(self):
        self.base_dir = Path(settings.DATA_DIR) / "storage"
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_path(self, object_name: str) -> Path:
        return self.base_dir / object_name

    def _to_netcdf_path(self, path: Path) -> Path:
        """Convert zarr-style path to .nc path."""
        if path.suffix == ".zarr":
            return path.with_suffix(".nc")
        if not path.suffix:
            return path.with_suffix(".nc")
        return path

    def upload_zarr_dataset(self, dataset: xr.Dataset, object_name: str) -> str:
        path = self._resolve_path(object_name)
        nc_path = self._to_netcdf_path(path)
        nc_path.parent.mkdir(parents=True, exist_ok=True)
        dataset.to_netcdf(str(nc_path))
        logger.info(f"Saved NetCDF dataset to {nc_path}")
        return object_name

    def download_zarr_dataset(self, object_name: str) -> xr.Dataset:
        path = self._resolve_path(object_name)
        nc_path = self._to_netcdf_path(path)

        # Try zarr first, then netcdf
        if path.exists() and path.is_dir():
            return xr.open_zarr(str(path))
        if nc_path.exists():
            return xr.open_dataset(str(nc_path), engine="netcdf4")

        raise FileNotFoundError(f"Dataset not found: {path} or {nc_path}")

    def upload_json(self, data: Dict, object_name: str) -> str:
        path = self._resolve_path(object_name)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            json.dump(data, f, indent=2, default=str)
        return object_name

    def download_json(self, object_name: str) -> Dict:
        path = self._resolve_path(object_name)
        if not path.exists():
            raise FileNotFoundError(f"JSON not found: {path}")
        with open(path, "r") as f:
            return json.load(f)

    def list_objects(self, prefix: str = "") -> List[str]:
        base = self._resolve_path(prefix)
        if not base.exists():
            return []
        return [str(p.relative_to(self.base_dir)) for p in base.rglob("*") if p.is_file()]

    def delete_object(self, object_name: str):
        path = self._resolve_path(object_name)
        if path.exists():
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()
            logger.info(f"Deleted: {path}")
