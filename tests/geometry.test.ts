import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildModel, importModel, partGeometry } from "../src/lib/geometry";
import { validateModel } from "../src/lib/exports";
import type { ModelDefinition } from "../src/types";
const model = (kind: string): ModelDefinition => ({
  id: kind,
  name: kind,
  kind,
  category: "test",
  description: "",
  dimensions: [4, 1, 2],
  cd: 0.3,
  liftSlope: 0,
});
describe("procedural geometry", () => {
  for (const kind of [
    "sphere",
    "cube",
    "cylinder",
    "cone",
    "torus",
    "capsule",
    "airfoil",
    "car",
    "truck",
    "rocket",
    "aircraft",
    "building",
    "bridge",
    "teardrop",
    "plate",
    "wedge",
    "bullet",
    "drone",
  ])
    it(`builds finite visible ${kind}`, () => {
      const object = buildModel(model(kind));
      const bounds = new THREE.Box3().setFromObject(object);
      expect(bounds.isEmpty()).toBe(false);
      const dimensions = bounds.getSize(new THREE.Vector3());
      expect(
        dimensions.toArray().every((n) => Number.isFinite(n) && n > 0),
      ).toBe(true);
    });
  it("applies custom rotations as degrees", () => {
    const object = buildModel({
      ...model("custom"),
      parts: [
        {
          id: "part",
          name: "box",
          shape: "box",
          position: [0, 0, 0],
          rotation: [0, 90, 0],
          scale: [1, 1, 3],
          color: "#ffffff",
        },
      ],
    });
    const bounds = new THREE.Box3()
      .setFromObject(object)
      .getSize(new THREE.Vector3());
    expect(bounds.x).toBeCloseTo(3);
    expect(bounds.z).toBeCloseTo(1);
  });
  it("rejects external glTF resources before loading", async () => {
    const data = JSON.stringify({
      asset: { version: "2.0" },
      buffers: [{ uri: "https://external.test/model.bin", byteLength: 8 }],
    });
    const file = {
      name: "model.gltf",
      size: data.length,
      arrayBuffer: async () => new TextEncoder().encode(data).buffer,
    } as File;
    await expect(importModel(file)).rejects.toThrow("External model resources");
  });
});

describe("local imports", () => {
  const file = (name: string, source: string) =>
    ({
      name,
      size: source.length,
      arrayBuffer: async () => new TextEncoder().encode(source).buffer,
    }) as File;
  for (const [name, source] of [
    ["triangle.obj", "v 0 0 0\nv 1 0 0\nv 0 2 1\nf 1 2 3"],
    [
      "triangle.stl",
      "solid triangle\nfacet normal 0 -1 2\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 2 1\nendloop\nendfacet\nendsolid triangle",
    ],
  ])
    it(`imports and restores ${name}`, async () => {
      const imported = await importModel(file(name, source));
      expect(imported.mesh).toBeTruthy();
      expect(Math.max(...imported.dimensions)).toBeCloseTo(4);
      const restored = buildModel(JSON.parse(JSON.stringify(imported)));
      const size = new THREE.Box3()
        .setFromObject(restored)
        .getSize(new THREE.Vector3());
      expect(size.toArray()).toEqual(imported.dimensions);
      expect(new THREE.Box3().setFromObject(restored).min.y).toBeCloseTo(0);
    });
});

it("editor primitives use their full scale as dimensions", () => {
  for (const kind of [
    "box",
    "sphere",
    "cylinder",
    "cone",
    "torus",
    "capsule",
    "wing",
  ]) {
    const g = partGeometry(kind);
    g.computeBoundingBox();
    const size = g.boundingBox!.getSize(new THREE.Vector3());
    for (const n of size.toArray()) expect(n).toBeCloseTo(1, 4);
  }
});

it("planar OBJ retains a planar mesh and a persistable 1 cm envelope", async () => {
  const source = "v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3";
  const imported = await importModel({
    name: "planar.obj",
    size: source.length,
    arrayBuffer: async () => new TextEncoder().encode(source).buffer,
  } as File);
  expect(imported.dimensions).toEqual([4, 4, 0.01]);
  expect(imported.description).toContain("1 cm minimum");
  const persisted = JSON.parse(JSON.stringify(imported));
  expect(() => validateModel(persisted)).not.toThrow();
  const actual = new THREE.Box3()
    .setFromObject(buildModel(persisted))
    .getSize(new THREE.Vector3());
  expect(actual.z).toBe(0);
});

it("planar STL remains persistable after import", async () => {
  const source =
    "solid plane\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid plane";
  const imported = await importModel({
    name: "planar.stl",
    size: source.length,
    arrayBuffer: async () => new TextEncoder().encode(source).buffer,
  } as File);
  expect(imported.dimensions).toEqual([4, 4, 0.01]);
  const persisted = JSON.parse(JSON.stringify(imported));
  expect(() => validateModel(persisted)).not.toThrow();
  expect(
    new THREE.Box3()
      .setFromObject(buildModel(persisted))
      .getSize(new THREE.Vector3()).z,
  ).toBe(0);
});
