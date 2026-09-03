import xarray as xr
from minio import Minio
from minio.error import S3Error
from typing import Optional, Dict, BinaryIO
import json
import io
import logging
from pathlib import Path

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class StorageService:
    """Handles storage operations with MinIO object store."""

    def __init__(self):
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=False,
        )
        self._ensure_bucket()

    def _ensure_bucket(self):
        """Create bucket if it doesn't exist."""
        if not self.client.bucket_exists(settings.MINIO_BUCKET):
            self.client.make_bucket(settings.MINIO_BUCKET)
            logger.info(f"Created bucket: {settings.MINIO_BUCKET}")

    def upload_zarr_dataset(
        self, dataset: xr.Dataset, object_name: str
    ) -> str:
        """Upload xarray dataset as Zarr to MinIO."""
        buffer = io.BytesIO()

        dataset.to_zarr(buffer, mode="w", consolidated=True)
        buffer.seek(0)

        self.client.put_object(
            settings.MINIO_BUCKET,
            object_name,
            buffer,
            length=buffer.getbuffer().nbytes,
            content_type="application/octet-stream",
        )

        logger.info(f"Uploaded Zarr dataset to {object_name}")
        return object_name

    def download_zarr_dataset(
        self, object_name: str
    ) -> xr.Dataset:
        """Download and load Zarr dataset from MinIO."""
        try:
            response = self.client.get_object(settings.MINIO_BUCKET, object_name)
            data = io.BytesIO(response.read())
            response.close()
            response.release_conn()

            dataset = xr.open_zarr(data, consolidated=True)
            logger.info(f"Downloaded Zarr dataset from {object_name}")
            return dataset

        except S3Error as e:
            logger.error(f"Error downloading {object_name}: {e}")
            raise

    def upload_json(self, data: Dict, object_name: str) -> str:
        """Upload JSON data to MinIO."""
        json_bytes = json.dumps(data, indent=2, default=str).encode("utf-8")
        buffer = io.BytesIO(json_bytes)

        self.client.put_object(
            settings.MINIO_BUCKET,
            object_name,
            buffer,
            length=len(json_bytes),
            content_type="application/json",
        )

        return object_name

    def download_json(self, object_name: str) -> Dict:
        """Download JSON data from MinIO."""
        try:
            response = self.client.get_object(settings.MINIO_BUCKET, object_name)
            data = json.loads(response.read().decode("utf-8"))
            response.close()
            response.release_conn()
            return data

        except S3Error as e:
            logger.error(f"Error downloading JSON {object_name}: {e}")
            raise

    def list_objects(self, prefix: str = "") -> list:
        """List all objects under a prefix."""
        objects = self.client.list_objects(
            settings.MINIO_BUCKET, prefix=prefix, recursive=True
        )
        return [obj.object_name for obj in objects]

    def delete_object(self, object_name: str):
        """Delete an object from MinIO."""
        try:
            self.client.remove_object(settings.MINIO_BUCKET, object_name)
            logger.info(f"Deleted object: {object_name}")
        except S3Error as e:
            logger.error(f"Error deleting {object_name}: {e}")
            raise

    def upload_local_zarr(self, local_path: str, object_name: str) -> str:
        """Upload a local Zarr directory to MinIO."""
        import shutil
        import tempfile

        with tempfile.TemporaryDirectory() as tmpdir:
            zip_path = shutil.make_archive(
                tmpdir + "/zarr_archive", "zip", local_path
            )

            with open(zip_path, "rb") as f:
                self.client.put_object(
                    settings.MINIO_BUCKET,
                    object_name,
                    f,
                    length=os.path.getsize(zip_path),
                    content_type="application/zip",
                )

        return object_name
