import asyncio
import logging
from datetime import datetime
import httpx

logger = logging.getLogger("alert_scanner")

PAN_INDIA_STATIONS = [
    {"name": "Surat & Tapi", "sub": "Gujarat Region", "lat": 21.17, "lon": 72.83},
    {"name": "Vadodara & Narmada", "sub": "Gujarat Region", "lat": 22.30, "lon": 73.18},
    {"name": "Rajkot", "sub": "Saurashtra & Kutch", "lat": 22.30, "lon": 70.80},
    {"name": "Nashik & Ghats", "sub": "North Madhya Maharashtra", "lat": 19.99, "lon": 73.78},
    {"name": "Mumbai & Konkan", "sub": "Konkan & Goa", "lat": 18.98, "lon": 72.83},
    {"name": "Ratnagiri", "sub": "Konkan & Goa", "lat": 16.99, "lon": 73.30},
    {"name": "Nagpur", "sub": "Vidarbha", "lat": 21.14, "lon": 79.08},
    {"name": "Bhopal", "sub": "West Madhya Pradesh", "lat": 23.25, "lon": 77.41},
    {"name": "Jabalpur", "sub": "East Madhya Pradesh", "lat": 23.18, "lon": 79.98},
    {"name": "Raipur", "sub": "Chhattisgarh", "lat": 21.25, "lon": 81.63},
    {"name": "Delhi NCR", "sub": "Haryana, Chandigarh & Delhi", "lat": 28.61, "lon": 77.23},
    {"name": "Jaipur", "sub": "East Rajasthan", "lat": 26.91, "lon": 75.78},
    {"name": "Jodhpur & Barmer", "sub": "West Rajasthan", "lat": 26.23, "lon": 73.02},
    {"name": "Amritsar", "sub": "Punjab", "lat": 31.63, "lon": 74.87},
    {"name": "Dehradun", "sub": "Uttarakhand", "lat": 30.31, "lon": 78.03},
    {"name": "Shimla", "sub": "Himachal Pradesh", "lat": 31.10, "lon": 77.17},
    {"name": "Drass & Kargil", "sub": "Jammu & Kashmir and Ladakh", "lat": 34.43, "lon": 75.76},
    {"name": "Kolkata", "sub": "Gangetic West Bengal", "lat": 22.57, "lon": 88.36},
    {"name": "Siliguri & Jalpaiguri", "sub": "Sub-Himalayan West Bengal", "lat": 26.72, "lon": 88.42},
    {"name": "Bhubaneswar", "sub": "Odisha", "lat": 20.29, "lon": 85.82},
    {"name": "Patna", "sub": "Bihar", "lat": 25.59, "lon": 85.13},
    {"name": "Ranchi", "sub": "Jharkhand", "lat": 23.34, "lon": 85.30},
    {"name": "Guwahati", "sub": "Assam & Meghalaya", "lat": 26.14, "lon": 91.73},
    {"name": "Cherrapunji (Sohra)", "sub": "Assam & Meghalaya", "lat": 25.30, "lon": 91.70},
    {"name": "Agartala", "sub": "Nagaland, Manipur, Mizoram & Tripura", "lat": 23.83, "lon": 91.28},
    {"name": "Chennai", "sub": "Tamil Nadu, Puducherry & Karaikal", "lat": 13.08, "lon": 80.27},
    {"name": "Visakhapatnam", "sub": "Coastal Andhra Pradesh", "lat": 17.68, "lon": 83.21},
    {"name": "Hyderabad", "sub": "Telangana", "lat": 17.38, "lon": 78.48},
    {"name": "Bengaluru", "sub": "South Interior Karnataka", "lat": 12.97, "lon": 77.59},
    {"name": "Mangaluru", "sub": "Coastal Karnataka", "lat": 12.91, "lon": 74.85},
    {"name": "Kochi & Wayanad", "sub": "Kerala & Mahe", "lat": 9.93, "lon": 76.26},
]

class PanIndiaAlertEngine:
    def __init__(self):
        self.cached_alerts = []
        self.last_sync_time = None
        self.active_regime = "Synoptic Normal"
        self.is_scanning = False

    def detect_synoptic_regime(self, stations_data: list) -> str:
        if not stations_data:
            return "Synoptic Normal"
            
        pressures = [d["pressure"] for d in stations_data if d.get("pressure")]
        wind_dirs = [d["wind_dir"] for d in stations_data if d.get("wind_dir")]
        
        avg_pressure = sum(pressures) / len(pressures) if pressures else 1010.0
        sw_winds = sum(1 for w in wind_dirs if 190 <= w <= 270)
        sw_ratio = sw_winds / len(wind_dirs) if wind_dirs else 0

        if avg_pressure < 1004.0 and sw_ratio > 0.40:
            return "Monsoon Trough Active"
        elif avg_pressure > 1016.0:
            return "Anticyclonic Subsidence / Stable"
        elif sw_ratio > 0.60:
            return "Tropical Convective Inflow"
        return "Synoptic Normal"

    async def scan_all_stations(self):
        if self.is_scanning:
            return
        self.is_scanning = True
        logger.info("Initiating server-side Pan-India multi-tier hazard audit...")

        evaluated_alerts = []
        station_diagnostics = []
        now_str = datetime.now().strftime("%H:%M IST")

        async with httpx.AsyncClient(timeout=20.0) as client:
            batch_size = 3
            for i in range(0, len(PAN_INDIA_STATIONS), batch_size):
                batch = PAN_INDIA_STATIONS[i:i+batch_size]
                tasks = []
                for spot in batch:
                    url = (
                        f"https://api.open-meteo.com/v1/forecast?"
                        f"latitude={spot['lat']}&longitude={spot['lon']}"
                        f"&current=temperature_2m,surface_pressure,wind_speed_10m,wind_direction_10m"
                        f"&hourly=precipitation&timezone=Asia%2FKolkata"
                    )
                    tasks.append(client.get(url))
                
                responses = await asyncio.gather(*tasks, return_exceptions=True)

                for spot, resp in zip(batch, responses):
                    if isinstance(resp, Exception) or resp.status_code != 200:
                        continue
                    try:
                        data = resp.json()
                        curr = data.get("current", {})
                        hourly = data.get("hourly", {})
                        
                        precip_series = hourly.get("precipitation", [])
                        true_24h_precip = sum(precip_series[:24]) if len(precip_series) >= 24 else 0.0

                        temp = curr.get("temperature_2m", 25.0)
                        wind = curr.get("wind_speed_10m", 10.0)
                        pressure = curr.get("surface_pressure", 1010.0)
                        wind_dir = curr.get("wind_direction_10m", 180)

                        station_diagnostics.append({
                            "pressure": pressure,
                            "wind_dir": wind_dir
                        })

                        # ---------------- 1. MULTI-TIER PRECIPITATION ----------------
                        if true_24h_precip >= 15.6:
                            if true_24h_precip >= 115.6:
                                severity = "Red Alert"
                                tier = "RED"
                                cat = "Extremely Heavy Rainfall"
                                cause = "Monsoonal mesoscale convective complex / cloudburst risk."
                                conf = 95
                            elif true_24h_precip >= 64.5:
                                severity = "Orange Alert"
                                tier = "ORANGE"
                                cat = "Heavy Rainfall"
                                cause = "Monsoonal cyclonic convergence and deep convective cloud mass."
                                conf = 90
                            else:
                                severity = "Yellow Advisory"
                                tier = "YELLOW"
                                cat = "Moderate Rainfall Advisory"
                                cause = "Active convective showers causing localized drainage and road waterlogging."
                                conf = 85

                            evaluated_alerts.append({
                                "alert_id": f"ALT-RAIN-{spot['name'][:4].upper()}",
                                "region": spot["name"],
                                "subdivision": spot["sub"],
                                "category": cat,
                                "severity": severity,
                                "tier": tier,
                                "lead_time": "Lead T+24h Horizon",
                                "observed_value": round(true_24h_precip, 1),
                                "threshold_value": 15.6,
                                "unit": "mm",
                                "confidence": conf,
                                "latitude": spot["lat"],
                                "longitude": spot["lon"],
                                "issued_at": now_str,
                                "synoptic_cause": cause
                            })

                        # ---------------- 2. MULTI-TIER WIND & SQUALL ----------------
                        if wind >= 25.0:
                            if wind >= 62.0:
                                severity = "Red Alert"
                                tier = "RED"
                                cat = "Gale Force Squall"
                                cause = "Severe cyclonic barometric gradient. Danger of structural and tree damage."
                                conf = 92
                            elif wind >= 40.0:
                                severity = "Orange Alert"
                                tier = "ORANGE"
                                cat = "Squally Wind Alert"
                                cause = "Strong pressure gradient flow. Hazardous for open transport and marine activity."
                                conf = 88
                            else:
                                severity = "Yellow Advisory"
                                tier = "YELLOW"
                                cat = "Gusty Wind Advisory"
                                cause = "Moderate localized wind gusts impacting light infrastructure."
                                conf = 82

                            evaluated_alerts.append({
                                "alert_id": f"ALT-WIND-{spot['name'][:4].upper()}",
                                "region": spot["name"],
                                "subdivision": spot["sub"],
                                "category": cat,
                                "severity": severity,
                                "tier": tier,
                                "lead_time": "Lead T+12h Horizon",
                                "observed_value": round(wind, 1),
                                "threshold_value": 25.0,
                                "unit": "km/h",
                                "confidence": conf,
                                "latitude": spot["lat"],
                                "longitude": spot["lon"],
                                "issued_at": now_str,
                                "synoptic_cause": cause
                            })

                        # ---------------- 3. MULTI-TIER THERMAL REGIMES ----------------
                        if temp >= 38.0:
                            if temp >= 45.0:
                                severity = "Red Alert"
                                tier = "RED"
                                cat = "Severe Heatwave"
                                conf = 94
                            elif temp >= 42.0:
                                severity = "Orange Alert"
                                tier = "ORANGE"
                                cat = "Heat Wave Alert"
                                conf = 89
                            else:
                                severity = "Yellow Advisory"
                                tier = "YELLOW"
                                cat = "Heat Advisory"
                                conf = 84

                            evaluated_alerts.append({
                                "alert_id": f"ALT-HEAT-{spot['name'][:4].upper()}",
                                "region": spot["name"],
                                "subdivision": spot["sub"],
                                "category": cat,
                                "severity": severity,
                                "tier": tier,
                                "lead_time": "Lead T+48h Horizon",
                                "observed_value": round(temp, 1),
                                "threshold_value": 38.0,
                                "unit": "°C",
                                "confidence": conf,
                                "latitude": spot["lat"],
                                "longitude": spot["lon"],
                                "issued_at": now_str,
                                "synoptic_cause": "Dry boundary layer subsidence and intense diurnal solar radiation."
                            })

                        elif temp <= 8.0:
                            if temp <= 3.0:
                                severity = "Red Alert"
                                tier = "RED"
                                cat = "Severe Cold Wave"
                                conf = 93
                            else:
                                severity = "Yellow Advisory"
                                tier = "YELLOW"
                                cat = "Cold Wave Advisory"
                                conf = 87

                            evaluated_alerts.append({
                                "alert_id": f"ALT-COLD-{spot['name'][:4].upper()}",
                                "region": spot["name"],
                                "subdivision": spot["sub"],
                                "category": cat,
                                "severity": severity,
                                "tier": tier,
                                "lead_time": "Lead T+24h Horizon",
                                "observed_value": round(temp, 1),
                                "threshold_value": 8.0,
                                "unit": "°C",
                                "confidence": conf,
                                "latitude": spot["lat"],
                                "longitude": spot["lon"],
                                "issued_at": now_str,
                                "synoptic_cause": "Steep katabatic drainage and high-altitude radiative thermal loss."
                            })

                    except Exception as parse_err:
                        logger.warning(f"Failed parsing station {spot['name']}: {parse_err}")

                await asyncio.sleep(1.5)

        self.cached_alerts = evaluated_alerts
        self.active_regime = self.detect_synoptic_regime(station_diagnostics)
        self.last_sync_time = now_str
        self.is_scanning = False
        logger.info(f"Scan complete. Active alerts: {len(evaluated_alerts)}. Regime: {self.active_regime}")

alert_engine = PanIndiaAlertEngine()