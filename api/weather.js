// 緯度,経度 から、アプリが読む形(現在の天気・4日間の予報)に変換して返します。天気の元データは Open-Meteo です。
const WMO = {0:"Clear",1:"Mostly Clear",2:"Partly Cloudy",3:"Cloudy",45:"Fog",48:"Fog",51:"Drizzle",53:"Drizzle",55:"Drizzle",56:"Freezing Drizzle",57:"Freezing Drizzle",
  61:"Rain",63:"Rain",65:"Heavy Rain",66:"Freezing Rain",67:"Freezing Rain",71:"Snow",73:"Snow",75:"Heavy Snow",77:"Snow",80:"Rain Showers",81:"Rain Showers",82:"Rain Showers",
  85:"Snow Showers",86:"Snow Showers",95:"Thunderstorm",96:"Thunderstorm",99:"Thunderstorm"};
const w = (c) => WMO[c] || "Cloudy";
module.exports = async (req, res) => {
  const m = String((req.query && req.query.location) || "").match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!m) return res.status(400).json({ error: "bad_location" });
  const lat = +m[1], lon = +m[2];
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return res.status(400).json({ error: "bad_location" });
  const url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
    "&current=temperature_2m,snowfall,weather_code,wind_speed_10m,wind_gusts_10m" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max" +
    "&timezone=Asia%2FTokyo&forecast_days=4";
  try {
    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: "upstream_" + r.status });
    const j = await r.json(), c = j.current || {}, d = j.daily || {};
    const forecasts = (d.time || []).map((t, i) => ({
      dateTimeISO: t + "T00:00:00+09:00", maxTempC: d.temperature_2m_max[i], minTempC: d.temperature_2m_min[i],
      precipMM: d.precipitation_sum[i], windSpeedMaxKPH: d.wind_speed_10m_max[i], weather: w(d.weather_code[i])
    }));
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=300");
    res.status(200).json({
      fetchedAt: Date.now(),
      current: { weather: { tempC: c.temperature_2m, snowCM: c.snowfall, weather: w(c.weather_code), windSpeedKPH: c.wind_speed_10m, windGustKPH: c.wind_gusts_10m, visibilityKM: null }, alerts: [] },
      forecast: { forecasts }
    });
  } catch (e) {
    res.status(502).json({ error: "fetch_failed" });
  }
};
