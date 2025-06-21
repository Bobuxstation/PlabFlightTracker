function interpolatePosition(start, end, progress) {
    return L.latLng(
        start.lat + (end.lat - start.lat) * progress,
        start.lng + (end.lng - start.lng) * progress
    );
}
function getHeading(from, to) {
    const angleRad = Math.atan2(to.lng - from.lng, to.lat - from.lat);
    return angleRad * 180 / Math.PI;
}
function getDistance(from, to) {
    return from.distanceTo(to);
}
function seededRandom(extraSeed = 0) {
  const now = new Date();
  const dateSeed = parseInt(
    `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`
  );

  // Combine the date and numeric seed
  let state = dateSeed + extraSeed;

  return function () {
    // LCG (Linear Congruential Generator) — deterministic sequence
    state = (1664525 * state + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
