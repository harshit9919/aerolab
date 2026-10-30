export type Vec3 = [number, number, number];
export type Primitive =
  | "box"
  | "sphere"
  | "cylinder"
  | "cone"
  | "torus"
  | "wing"
  | "capsule";
export interface Part {
  id: string;
  name: string;
  shape: Primitive;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  color: string;
}
export interface ModelDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  kind: string;
  dimensions: Vec3;
  cd: number;
  liftSlope: number;
  parts?: Part[];
  mesh?: Record<string, unknown>;
  custom?: boolean;
}
export interface Settings {
  speed: number;
  yaw: number;
  pitch: number;
  temperature: number;
  altitude: number;
  turbulence: number;
  gust: number;
  gustFrequency: number;
  roughness: number;
  scale: number;
  duration: number;
}
export interface Scenario {
  id: string;
  name: string;
  description: string;
  tag: string;
  settings: Partial<Settings>;
}
export type ViewMode = "streamlines" | "particles" | "pressure" | "velocity";
export interface Metrics {
  speed: number;
  drag: number;
  lift: number;
  cd: number;
  cl: number;
  pressure: number;
  reynolds: number;
  mach: number;
  density: number;
  area: number;
  efficiency: number;
}
export interface Sample extends Metrics {
  time: number;
}
export interface Run {
  id: string;
  name: string;
  createdAt: string;
  model: ModelDefinition;
  settings: Settings;
  scenarioId: string;
  samples: Sample[];
  duration: number;
  notes: string;
  color: string;
}
export interface Workspace {
  version: 1;
  models: ModelDefinition[];
  runs: Run[];
  settings: Settings;
  activeModelId: string;
}
