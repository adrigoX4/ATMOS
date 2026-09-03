import io
import logging
import numpy as np
import xarray as xr
from typing import Optional, Dict, List, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)


class GeoTIFFExporter:
    """Export blended forecasts as GeoTIFF for GIS software integration."""

    def __init__(self):
        self.output_dir = Path("./data/geotiff")
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def export_single_variable(
        self,
        dataset: xr.Dataset,
        variable: str,
        output_path: Optional[str] = None,
        crs: str = "EPSG:4326",
    ) -> str:
        """Export a single variable as GeoTIFF."""
        if variable not in dataset:
            raise ValueError(f"Variable {variable} not found in dataset")

        data = dataset[variable]
        lats = dataset.latitude.values
        lons = dataset.longitude.values

        if output_path is None:
            output_path = str(self.output_dir / f"{variable}_forecast.tif")

        try:
            import rasterio
            from rasterio.transform import from_bounds
            from rasterio.crs import CRS

            transform = from_bounds(
                lons.min(), lats.min(), lons.max(), lats.max(),
                len(lons), len(lats)
            )

            if data.ndim == 2:
                data_array = data.values
            elif data.ndim == 3:
                data_array = data.mean(dim="time").values if "time" in data.dims else data[0].values
            else:
                data_array = data.values

            data_array = np.flipud(data_array)

            with rasterio.open(
                output_path,
                "w",
                driver="GTiff",
                height=len(lats),
                width=len(lons),
                count=1,
                dtype=data_array.dtype,
                crs=CRS.from_string(crs),
                transform=transform,
                compress="lzw",
            ) as dst:
                dst.write(data_array, 1)
                dst.update_tags(
                    VARIABLE=variable,
                    UNIT="mm" if variable == "tp" else "celsius" if variable == "t2m" else "m/s",
                    CREATED=str(np.datetime64("now")),
                    SOURCE="AI-NWP Blending Platform",
                )

            logger.info(f"Exported GeoTIFF: {output_path}")
            return output_path

        except ImportError:
            logger.warning("rasterio not available, using numpy fallback")
            return self._export_numpy_fallback(data, lats, lons, output_path)

    def export_multi_band(
        self,
        dataset: xr.Dataset,
        variables: List[str],
        output_path: Optional[str] = None,
    ) -> str:
        """Export multiple variables as multi-band GeoTIFF."""
        if output_path is None:
            output_path = str(self.output_dir / "multi_variable_forecast.tif")

        try:
            import rasterio
            from rasterio.transform import from_bounds
            from rasterio.crs import CRS

            lats = dataset.latitude.values
            lons = dataset.longitude.values

            transform = from_bounds(
                lons.min(), lats.min(), lons.max(), lats.max(),
                len(lons), len(lats)
            )

            valid_vars = [v for v in variables if v in dataset]
            if not valid_vars:
                raise ValueError("No valid variables found")

            bands = []
            descriptions = []
            for var in valid_vars:
                data = dataset[var]
                if data.ndim == 3:
                    arr = data.mean(dim="time").values if "time" in data.dims else data[0].values
                else:
                    arr = data.values
                bands.append(np.flipud(arr))
                descriptions.append(var)

            with rasterio.open(
                output_path,
                "w",
                driver="GTiff",
                height=len(lats),
                width=len(lons),
                count=len(bands),
                dtype=bands[0].dtype,
                crs=CRS.from_string("EPSG:4326"),
                transform=transform,
                compress="lzw",
            ) as dst:
                for i, (band, desc) in enumerate(zip(bands, descriptions), 1):
                    dst.write(band, i)
                    dst.set_band_description(i, desc)

            logger.info(f"Exported multi-band GeoTIFF: {output_path}")
            return output_path

        except ImportError:
            logger.warning("rasterio not available, using numpy fallback")
            return self._export_numpy_fallback(
                dataset[valid_vars[0]], lats, lons, output_path
            )

    def export_weight_map(
        self,
        weight_dataset: xr.Dataset,
        model_name: str,
        variable: str,
        output_path: Optional[str] = None,
    ) -> str:
        """Export model weight distribution as GeoTIFF."""
        if output_path is None:
            output_path = str(self.output_dir / f"weights_{model_name}_{variable}.tif")

        if model_name in weight_dataset:
            weights = weight_dataset[model_name]
        elif "model" in weight_dataset.dims:
            model_idx = list(weight_dataset.model.values).index(model_name)
            weights = weight_dataset.isel(model=model_idx)
        else:
            raise ValueError(f"Weight data for {model_name} not found")

        return self.export_single_variable(
            xr.Dataset({"weights": weights}), "weights", output_path
        )

    def export_alert_shapefile(
        self,
        alerts: List[Dict],
        output_path: Optional[str] = None,
    ) -> str:
        """Export extreme weather alerts as GeoJSON."""
        if output_path is None:
            output_path = str(self.output_dir / "alerts.geojson")

        features = []
        for alert in alerts:
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [alert["longitude"], alert["latitude"]],
                },
                "properties": {
                    "alert_type": alert.get("type", "unknown"),
                    "severity": alert.get("severity", "unknown"),
                    "value": alert.get("value", 0),
                    "threshold": alert.get("threshold", 0),
                    "message": alert.get("message", ""),
                },
            }
            features.append(feature)

        geojson = {
            "type": "FeatureCollection",
            "features": features,
        }

        import json
        with open(output_path, "w") as f:
            json.dump(geojson, f, indent=2)

        logger.info(f"Exported alert GeoJSON: {output_path}")
        return output_path

    def _export_numpy_fallback(
        self, data: xr.DataArray, lats: np.ndarray, lons: np.ndarray, output_path: str
    ) -> str:
        """Fallback export using numpy when rasterio is not available."""
        np.savez_compressed(
            output_path.replace(".tif", ".npz"),
            data=data.values if hasattr(data, "values") else data,
            latitude=lats,
            longitude=lons,
        )
        logger.info(f"Exported numpy fallback: {output_path.replace('.tif', '.npz')}")
        return output_path.replace(".tif", ".npz")

    def get_export_list(self) -> List[str]:
        """List all exported GeoTIFF files."""
        return [str(f) for f in self.output_dir.glob("*.tif")] + [
            str(f) for f in self.output_dir.glob("*.npz")
        ] + [str(f) for f in self.output_dir.glob("*.geojson")]
