import { useEffect, useRef } from "react";

type Point = { lat: number; lng: number; intensity: number };

export function NoiseMap({ points }: { points: Point[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let mapInstance: any = null;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !ref.current) return;
      const map = L.map(ref.current, {
        center: [52.2333, 4.8333],
        zoom: 13,
        scrollWheelZoom: false,
        zoomControl: false,
        attributionControl: false,
      });
      mapInstance = map;
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", {
        subdomains: "abcd",
      }).addTo(map);

      points.forEach((p) => {
        const color = p.intensity > 75 ? "#ff3c2a" : p.intensity > 65 ? "#ff8a3c" : "#ffc83c";
        L.circleMarker([p.lat, p.lng], {
          radius: 8 + (p.intensity - 60) * 0.4,
          color,
          fillColor: color,
          fillOpacity: 0.45,
          weight: 1,
        }).addTo(map);
      });
    })();
    return () => {
      cancelled = true;
      if (mapInstance) mapInstance.remove();
    };
  }, [points]);

  return <div ref={ref} className="absolute inset-0" />;
}
