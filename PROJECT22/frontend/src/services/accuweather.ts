declare const process: any;

const ACCU_KEY = process.env.REACT_APP_ACCUWEATHER_API_KEY;

export interface AccuObservation {
  temperature: number;
  weatherText: string;
  hasPrecipitation: boolean;
  relativeHumidity: number;
  windSpeed: number;
  locationKey: string;
  city: string;
}

/**
 * Fetch official AccuWeather ground-truth observational conditions.
 * Used for point-source microclimate verification against NWP models.
 */
export const fetchAccuGroundTruth = async (
  lat: number,
  lon: number
): Promise<AccuObservation | null> => {
  if (!ACCU_KEY) return null;

  try {
    // 1. Resolve AccuWeather Location Key via Geoposition endpoint
    const geoRes = await fetch(
      `https://dataservice.accuweather.com/locations/v1/cities/geoposition/search?apikey=${ACCU_KEY}&q=${lat},${lon}`
    );
    if (!geoRes.ok) return null;
    const geoData = await geoRes.json();
    const locationKey = geoData?.Key;
    const city = geoData?.LocalizedName || 'Station';

    if (!locationKey) return null;

    // 2. Fetch live current observation
    const condRes = await fetch(
      `https://dataservice.accuweather.com/currentconditions/v1/${locationKey}?apikey=${ACCU_KEY}&details=true`
    );
    if (!condRes.ok) return null;
    const condData = await condRes.json();
    const current = condData?.[0];

    return {
      temperature: current?.Temperature?.Metric?.Value ?? 0,
      weatherText: current?.WeatherText ?? 'Clear',
      hasPrecipitation: current?.HasPrecipitation ?? false,
      relativeHumidity: current?.RelativeHumidity ?? 50,
      windSpeed: current?.Wind?.Speed?.Metric?.Value ?? 0,
      locationKey,
      city,
    };
  } catch (err) {
    console.error('AccuWeather ground truth fetch error:', err);
    return null;
  }
};