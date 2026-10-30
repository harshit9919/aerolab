import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import type { ModelDefinition, Part } from "../types";
const metal = (color: string, roughness = 0.28, metalness = 0.65) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
function wingGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-1, 0);
  shape.bezierCurveTo(-0.6, 0.28, 0.5, 0.12, 1, 0);
  shape.bezierCurveTo(0.4, -0.05, -0.7, -0.08, -1, 0);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 2,
    bevelEnabled: false,
    curveSegments: 20,
  });
  g.translate(0, 0, -1);
  return g;
}
function unitGeometry(g: THREE.BufferGeometry) {
  g.computeBoundingBox();
  const size = g.boundingBox!.getSize(new THREE.Vector3());
  g.scale(1 / size.x, 1 / size.y, 1 / size.z);
  return g;
}
export function partGeometry(shape: string): THREE.BufferGeometry {
  switch (shape) {
    case "sphere":
      return new THREE.SphereGeometry(0.5, 40, 28);
    case "cylinder":
      return new THREE.CylinderGeometry(0.5, 0.5, 1, 40);
    case "cone":
      return new THREE.ConeGeometry(0.5, 1, 40);
    case "torus":
      return unitGeometry(new THREE.TorusGeometry(0.36, 0.14, 20, 48));
    case "capsule":
      return unitGeometry(new THREE.CapsuleGeometry(0.4, 0.8, 12, 28));
    case "wing":
    case "airfoil":
      return unitGeometry(wingGeometry());
    default:
      return new THREE.BoxGeometry(1, 1, 1);
  }
}
export function buildModel(model: ModelDefinition): THREE.Group {
  const group = new THREE.Group();
  group.name = model.name;
  const add = (
    g: THREE.BufferGeometry,
    position: number[],
    scale: number[],
    material: THREE.Material = metal("#aebcbe"),
    rotation: number[] = [0, 0, 0],
  ) => {
    const m = new THREE.Mesh(g, material);
    m.position.set(...(position as [number, number, number]));
    m.scale.set(...(scale as [number, number, number]));
    m.rotation.set(...(rotation as [number, number, number]));
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const box = (p: number[], s: number[], c = "#b8c4c6") =>
    add(new THREE.BoxGeometry(1, 1, 1), p, s, metal(c));
  const ell = (p: number[], s: number[], c = "#b8c4c6") =>
    add(new THREE.SphereGeometry(1, 32, 20), p, s, metal(c));
  const cyl = (
    p: number[],
    s: number[],
    c = "#aab8bb",
    r = [0, 0, Math.PI / 2],
  ) => add(new THREE.CylinderGeometry(1, 1, 1, 40), p, s, metal(c), r);
  if (model.mesh) {
    try {
      group.add(new THREE.ObjectLoader().parse(model.mesh));
      return group;
    } catch {
      throw new Error(
        "This imported model could not be reconstructed. Import its original file again.",
      );
    }
  }
  if (model.parts?.length) {
    model.parts.forEach((p: Part) => {
      const m = add(
        partGeometry(p.shape),
        p.position,
        p.scale,
        metal(p.color),
        p.rotation.map(THREE.MathUtils.degToRad),
      );
      m.userData.partId = p.id;
      m.name = p.name;
    });
    return group;
  }
  const kind = model.kind;
  if (kind === "car" || kind === "truck") {
    box([0, 0.35, 0], [3.45, 0.28, 1.43], "#99a9ac");
    ell([0, 0.55, 0], [1.85, 0.31, 0.77], "#9dadaf");
    box([0, 0.3, 0], [3.45, 0.07, 1.49], "#55666a");
    if (kind === "truck") {
      box([-0.55, 1.12, 0], [2.35, 1.2, 1.62], "#b9c5c5");
      box([1.13, 0.91, 0], [1.05, 0.95, 1.5]);
      box([1.34, 1.1, 0], [0.65, 0.42, 1.53], "#243d42");
    } else {
      ell([-0.25, 0.84, 0], [1.01, 0.41, 0.625], "#152d34");
      add(
        new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, 0.72),
        [-0.25, 0.84, 0],
        [1.018, 0.417, 0.63],
        metal("#a8b8ba"),
      );
      for (const z of [-0.62, 0.62]) {
        box([-0.32, 0.77, z], [1.42, 0.035, 0.024], "#778d91");
        box([-0.37, 0.94, z * 0.985], [0.055, 0.22, 0.025], "#7d9295");
      }
    }
    for (const x of [-1.16, 1.15])
      for (const z of [-0.79, 0.79]) {
        cyl([x, 0.34, z], [0.34, 0.22, 0.34], "#172020", [Math.PI / 2, 0, 0]);
        cyl([x, 0.34, z * 1.025], [0.225, 0.23, 0.225], "#81979b", [
          Math.PI / 2,
          0,
          0,
        ]);
        cyl([x, 0.34, z * 1.04], [0.09, 0.24, 0.09], "#59696b", [
          Math.PI / 2,
          0,
          0,
        ]);
      }
    for (const z of [-0.55, 0.55]) {
      box([1.72, 0.615, z], [0.055, 0.06, 0.28], "#e3ffeb");
      box([-1.72, 0.59, z], [0.055, 0.055, 0.28], "#ec6d51");
    }
    box([1.87, 0.4, 0], [0.04, 0.12, 0.8], "#203032");
  } else if (kind === "aircraft") {
    ell([0, 0.63, 0], [1.9, 0.25, 0.25]);
    add(
      new THREE.ConeGeometry(0.25, 0.75, 36),
      [1.65, 0.63, 0],
      [1, 1, 1],
      metal("#b8c7cb"),
      [0, 0, -Math.PI / 2],
    );
    add(wingGeometry(), [-0.15, 0.65, 0], [0.64, 0.55, 1.7]);
    add(wingGeometry(), [-1.35, 0.7, 0], [0.35, 0.6, 0.62]);
    box([-1.4, 0.93, 0], [0.55, 0.65, 0.065]);
    ell([0.85, 0.82, 0], [0.38, 0.12, 0.19], "#23444b");
  } else if (kind === "rocket" || kind === "bullet") {
    cyl([-0.2, 0.6, 0], [0.42, 2.4, 0.42]);
    add(
      new THREE.ConeGeometry(0.42, 1.2, 48),
      [1.6, 0.6, 0],
      [1, 1, 1],
      metal("#d2d9da"),
      [0, 0, -Math.PI / 2],
    );
    if (kind === "rocket")
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        box(
          [-1.1, 0.6 + Math.cos(a) * 0.4, Math.sin(a) * 0.4],
          [0.8, 0.1, 0.7],
        ).rotation.x = a;
      }
  } else if (kind === "drone") {
    ell([0, 0.7, 0], [0.65, 0.2, 0.4]);
    for (const x of [-0.9, 0.9])
      for (const z of [-0.9, 0.9]) {
        box([x / 2, 0.7, z / 2], [1.35, 0.08, 0.09]).rotation.y = -Math.atan2(
          z,
          x,
        );
        cyl([x, 0.76, z], [0.15, 0.2, 0.15], "#324343", [0, 0, 0]);
        ell([x, 0.9, z], [0.5, 0.018, 0.12], "#596b6c");
      }
  } else if (kind === "building") {
    box([0, 1, 0], [1.8, 2, 1.8]);
    for (let y = 0.3; y < 2; y += 0.3)
      for (const z of [-0.91, 0.91])
        box([0, y, z], [1.6, 0.1, 0.012], "#42686b");
  } else if (kind === "bridge") {
    box([0, 1, 0], [4, 0.17, 1.5]);
    for (const x of [-1.3, 1.3]) box([x, 0.5, 0], [0.25, 1, 1.4]);
  } else if (kind === "plate") box([0, 0.6, 0], [2, 0.08, 2]);
  else if (kind === "wedge") {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          -1, 0, -0.7, 1, 0, -0.7, -1, 1, -0.7, -1, 0, 0.7, -1, 1, 0.7, 1, 0,
          0.7, -1, 0, -0.7, -1, 1, -0.7, -1, 1, 0.7, -1, 0, -0.7, -1, 1, 0.7,
          -1, 0, 0.7, 1, 0, -0.7, 1, 0, 0.7, -1, 1, 0.7, 1, 0, -0.7, -1, 1, 0.7,
          -1, 1, -0.7, -1, 0, -0.7, -1, 0, 0.7, 1, 0, 0.7, -1, 0, -0.7, 1, 0,
          0.7, 1, 0, -0.7,
        ],
        3,
      ),
    );
    g.computeVertexNormals();
    add(g, [0, 0, 0], [1, 1, 1]);
  } else if (kind === "teardrop") {
    ell([0.3, 0.6, 0], [1.3, 0.55, 0.55]);
    add(
      new THREE.ConeGeometry(0.55, 2, 48),
      [-1, 0.6, 0],
      [1, 1, 1],
      metal("#b8c7cb"),
      [0, 0, Math.PI / 2],
    );
  } else {
    const primitive = kind === "cube" ? "box" : kind;
    const g = partGeometry(primitive);
    const m = add(
      g,
      [0, 0.65, 0],
      kind === "airfoil" ? [1.5, 1, 1] : [1.4, 1.4, 1.4],
    );
    if (kind === "capsule" || kind === "cone") m.rotation.z = -Math.PI / 2;
    if (kind === "torus") m.rotation.y = Math.PI / 2;
  }
  if (
    ["car", "truck", "rocket", "bullet", "aircraft", "teardrop"].includes(kind)
  )
    group.rotation.y = Math.PI;
  // Match the catalog envelope so geometry and aerodynamic dimensions stay consistent.
  const bounds = new THREE.Box3().setFromObject(group),
    actual = bounds.getSize(new THREE.Vector3());
  group.scale.set(
    ...(model.dimensions.map(
      (n, i) => Math.max(0.01, n) / Math.max(0.001, actual.getComponent(i)),
    ) as [number, number, number]),
  );
  const scaled = new THREE.Box3().setFromObject(group);
  group.position.y = -scaled.min.y;
  const normalized = new THREE.Group();
  normalized.name = model.name;
  normalized.add(group);
  return normalized;
}
export async function importModel(file: File): Promise<ModelDefinition> {
  if (file.size > 25 * 1024 * 1024)
    throw new Error("Model is too large. Choose a file under 25 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase();
  const data = await file.arrayBuffer();
  let object: THREE.Object3D;
  if (ext === "glb" || ext === "gltf") {
    let json: any;
    if (ext === "gltf") {
      try {
        json = JSON.parse(new TextDecoder().decode(data));
      } catch {
        throw new Error("Invalid glTF JSON.");
      }
    } else {
      const v = new DataView(data);
      if (v.byteLength < 20 || v.getUint32(0, true) !== 0x46546c67)
        throw new Error("Invalid GLB header.");
      const n = v.getUint32(12, true);
      try {
        json = JSON.parse(new TextDecoder().decode(data.slice(20, 20 + n)));
      } catch {
        throw new Error("Invalid GLB JSON chunk.");
      }
    }
    if (
      [...(json.buffers ?? []), ...(json.images ?? [])].some(
        (v: any) => v.uri && !v.uri.startsWith("data:"),
      )
    )
      throw new Error(
        "External model resources are not supported. Export a self-contained GLB or embed all glTF resources.",
      );
    const result = await new GLTFLoader().parseAsync(
      ext === "gltf" ? new TextDecoder().decode(data) : data,
      "",
    );
    object = result.scene;
  } else if (ext === "stl") {
    object = new THREE.Mesh(new STLLoader().parse(data), metal("#b9c7c9"));
  } else if (ext === "obj") {
    const source = new TextDecoder().decode(data);
    if (/^\s*(mtllib|map_)\s/m.test(source))
      throw new Error(
        "OBJ references external materials. Export a self-contained GLB, STL, or OBJ without material references.",
      );
    object = new OBJLoader().parse(source);
  } else
    throw new Error("Supported formats: GLB, embedded glTF, STL, and OBJ.");
  let triangles = 0,
    meshes = 0;
  object.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      meshes++;
      const p = o.geometry.getAttribute("position");
      if (!p) throw new Error("A mesh is missing its positions.");
      for (let i = 0; i < p.array.length; i++)
        if (!Number.isFinite(p.array[i]))
          throw new Error("Model contains invalid geometry coordinates.");
      triangles += (o.geometry.index?.count ?? p.count) / 3;
      o.material = metal("#bbc7c9");
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  if (!meshes || !triangles)
    throw new Error("This file has no visible triangle meshes.");
  if (triangles > 500000)
    throw new Error(
      "Model exceeds 500,000 triangles. Simplify it before importing.",
    );
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object),
    size = bounds.getSize(new THREE.Vector3()),
    center = bounds.getCenter(new THREE.Vector3());
  const length = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(length) || length <= 0)
    throw new Error("Model has invalid or empty bounds.");
  const container = new THREE.Group();
  object.position.sub(center);
  container.add(object);
  container.scale.setScalar(4 / length);
  container.position.y = (size.y * 2) / length;
  container.updateMatrixWorld(true);
  return {
    id: crypto.randomUUID(),
    name: file.name.replace(/\.[^.]+$/, ""),
    category: "Imported",
    description:
      "Imported 3D geometry; aerodynamic estimates use its bounding dimensions. Planar or thinner-than-1 cm envelope dimensions use a 1 cm minimum; the visible mesh is unchanged.",
    kind: "imported",
    dimensions: [
      Math.max(0.01, (size.x * 4) / length),
      Math.max(0.01, (size.y * 4) / length),
      Math.max(0.01, (size.z * 4) / length),
    ],
    cd: 0.6,
    liftSlope: 0,
    custom: true,
    mesh: container.toJSON() as unknown as Record<string, unknown>,
  };
}
export async function exportModel(model: ModelDefinition): Promise<void> {
  const object = buildModel(model);
  try {
    const result = await new GLTFExporter().parseAsync(object, {
      binary: true,
    });
    const blob = new Blob([result as ArrayBuffer], {
      type: "model/gltf-binary",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${model.name.replace(/[^a-z0-9_-]/gi, "-")}.glb`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    object.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }
}
