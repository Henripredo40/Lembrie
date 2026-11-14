export type PontoPerimetro = { latitude: number; longitude: number };

export function distanciaEmMetros(origem: PontoPerimetro, destino: PontoPerimetro) {
  const radianos = (graus: number) => graus * Math.PI / 180;
  const dLat = radianos(destino.latitude - origem.latitude);
  const dLon = radianos(destino.longitude - origem.longitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radianos(origem.latitude)) * Math.cos(radianos(destino.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
