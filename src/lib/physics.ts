import type { ModelDefinition, Settings, Metrics, Vec3 } from "../types";
const finite = (n: number, fallback = 0) => (Number.isFinite(n) ? n : fallback);
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, finite(n)));
const rad = (n: number) => (finite(n) * Math.PI) / 180;
function rotate([x, y, z]: Vec3, [rx, ry, rz]: Vec3): Vec3 {
  // Three's default XYZ Euler matrix applies Z, then Y, then X to a point.
  const a = x * Math.cos(rz) - y * Math.sin(rz),
    b = x * Math.sin(rz) + y * Math.cos(rz);
  const c = a * Math.cos(ry) + z * Math.sin(ry),
    d = -a * Math.sin(ry) + z * Math.cos(ry);
  return [
    c,
    b * Math.cos(rx) - d * Math.sin(rx),
    b * Math.sin(rx) + d * Math.cos(rx),
  ];
}
/** True axis-aligned envelope span; part scale represents full dimensions in metres. */
export function modelDimensions(model: ModelDefinition): Vec3 {
  if (!model.parts?.length)
    return model.dimensions.map((n) => clamp(Math.abs(n), 0.01, 10000)) as Vec3;
  const min: Vec3 = [Infinity, Infinity, Infinity],
    max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const part of model.parts)
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1]) {
          const p = rotate(
            [
              (sx * finite(part.scale[0])) / 2,
              (sy * finite(part.scale[1])) / 2,
              (sz * finite(part.scale[2])) / 2,
            ],
            part.rotation.map(rad) as Vec3,
          );
          for (let i = 0; i < 3; i++) {
            const coordinate = p[i] + finite(part.position[i]);
            min[i] = Math.min(min[i], coordinate);
            max[i] = Math.max(max[i], coordinate);
          }
        }
  return max.map((n, i) => clamp(n - min[i], 0.01, 10000)) as Vec3;
}
export function effectiveSpeed(settings: Settings, time = 0): number {
  const speed = clamp(settings.speed, 0, 1000);
  return Math.max(
    0,
    speed +
      clamp(settings.gust, 0, 500) *
        Math.sin(
          2 * Math.PI * clamp(settings.gustFrequency, 0, 20) * finite(time),
        ),
  );
}
/** Educational q·Cd·A model: https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/
 * All body coefficients and attitude corrections are assumptions; this is not CFD.
 */
export function calculateMetrics(
  model: ModelDefinition,
  settings: Settings,
  time = 0,
): Metrics {
  const speed = effectiveSpeed(settings, time),
    scale = clamp(settings.scale, 0.01, 100);
  const [l, h, w] = modelDimensions(model).map((n) => n * scale);
  const yaw = rad(settings.yaw),
    pitch = rad(settings.pitch);
  const kelvin = clamp(settings.temperature + 273.15, 150, 400);
  const density =
    (101325 * Math.exp(-clamp(settings.altitude, -500, 20000) / 8434.5)) /
    (287.05 * kelvin);
  const area = Math.max(
    0.0001,
    h * w * Math.abs(Math.cos(yaw) * Math.cos(pitch)) +
      l * h * Math.abs(Math.sin(yaw)) +
      l * w * Math.abs(Math.sin(pitch)),
  );
  const cl = clamp(
    finite(model.liftSlope) * Math.sin(pitch) * Math.cos(yaw),
    -2,
    2,
  );
  const cd =
    clamp(model.cd, 0.01, 4) *
      (1 +
        0.65 * Math.sin(yaw) ** 2 +
        0.35 * Math.sin(pitch) ** 2 +
        0.22 * clamp(settings.roughness, 0, 1) +
        0.08 * clamp(settings.turbulence, 0, 1)) +
    0.08 * cl * cl;
  const pressure = 0.5 * density * speed * speed;
  const drag = pressure * area * cd,
    lift = pressure * area * cl;
  const viscosity =
    (1.716e-5 * (kelvin / 273.15) ** 1.5 * (273.15 + 110.4)) / (kelvin + 110.4);
  return {
    speed,
    drag,
    lift,
    cd,
    cl,
    pressure,
    reynolds: (density * speed * l) / viscosity,
    mach: speed / Math.sqrt(1.4 * 287.05 * kelvin),
    density,
    area,
    efficiency: drag ? lift / drag : 0,
  };
}
/** Analytic envelope deflection and wake visualization, not a solved fluid field. */
export function flowVelocity(
  point: Vec3,
  model: ModelDefinition,
  settings: Settings,
  time = 0,
): Vec3 {
  const speed = effectiveSpeed(settings, time);
  if (!speed) return [0, 0, 0];
  const scale = clamp(settings.scale, 0.01, 100);
  const [l, h, w] = modelDimensions(model).map((n) => n * scale);
  const yaw = rad(settings.yaw),
    pitch = rad(settings.pitch);
  const [x, y, z] = rotate(rotate(point, [0, 0, -pitch]), [0, -yaw, 0]);
  const a = l / 2,
    b = h / 2,
    c = w / 2;
  const radial = Math.sqrt((y / b) ** 2 + (z / c) ** 2);
  const envelope = Math.exp(-0.7 * (x / a) ** 2 - 0.65 * radial * radial);
  const downstream = Math.max(0, x - a);
  const spread = 1 + (downstream / Math.max(l, 0.1)) * 0.7;
  const wake =
    x > a
      ? Math.exp(-downstream / (l * 3)) *
        Math.exp((-radial * radial) / (spread * spread))
      : 0;
  const turbulence = clamp(settings.turbulence, 0, 1);
  const phase = finite(time) * 4 - x * 2;
  const vx =
    speed * (1 - 0.7 * envelope - (0.4 + clamp(model.cd, 0, 2) * 0.12) * wake);
  const vy =
    speed *
    (((0.68 * y) / Math.max(b, 0.01)) * envelope +
      0.16 * turbulence * wake * Math.sin(phase + z));
  const vz =
    speed *
    (((0.68 * z) / Math.max(c, 0.01)) * envelope +
      0.16 * turbulence * wake * Math.cos(phase * 1.13 + y));
  const disturbance = rotate(rotate([vx - speed, vy, vz], [0, yaw, 0]), [
    0,
    0,
    pitch,
  ]);
  return [
    finite(speed + disturbance[0]),
    finite(disturbance[1]),
    finite(disturbance[2]),
  ];
}
