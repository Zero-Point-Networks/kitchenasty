/**
 * Ray-casting algorithm to determine if a point is inside a polygon.
 * @param lat - Latitude of the point
 * @param lng - Longitude of the point
 * @param polygon - Array of [lat, lng] coordinate pairs forming the polygon
 */
export function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: [number, number][]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [lat_i, lng_i] = polygon[i];
    const [lat_j, lng_j] = polygon[j];

    const crosses = lat_i > lat !== lat_j > lat;
    if (!crosses) continue;
    const xIntersect = ((lng_j - lng_i) * (lat - lat_i)) / (lat_j - lat_i) + lng_i;
    if (lng < xIntersect) inside = !inside;
  }
  return inside;
}
