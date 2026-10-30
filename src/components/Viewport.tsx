import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { buildModel } from "../lib/geometry";
import { flowVelocity, modelDimensions, effectiveSpeed } from "../lib/physics";
import type { ModelDefinition, Settings, ViewMode, Part } from "../types";
export interface ViewportHandle {
  resetCamera(): void;
  setCamera(view: "perspective" | "top" | "side" | "front"): void;
  zoom(factor: number): void;
  screenshot(): void;
}
interface Props {
  model: ModelDefinition;
  settings: Settings;
  time: number;
  playing: boolean;
  mode: ViewMode;
  showGrid: boolean;
  showTunnel: boolean;
  density: number;
  editing: boolean;
  selectedPartId: string | null;
  transformMode: "translate" | "rotate" | "scale";
  onSelectPart: (id: string | null) => void;
  onPartChange: (part: Part) => void;
  onStats?: (stats: { fps: number; triangles: number }) => void;
}
// Exact integral of max(0, base + gust*sin(omega*t)); deterministic under scrubbing.
function windDistance(settings: Settings, time: number) {
  const t = Math.max(0, time),
    base = Math.max(0, settings.speed),
    gust = Math.max(0, settings.gust),
    omega = 2 * Math.PI * Math.max(0, settings.gustFrequency);
  if (!gust || !omega) return base * t;
  if (base >= gust)
    return base * t + (gust * (1 - Math.cos(omega * t))) / omega;
  const alpha = Math.asin(base / gust),
    period = 2 * Math.PI,
    theta = omega * t,
    cycles = Math.floor(theta / period),
    phase = theta - cycles * period;
  const primitive = (x: number) => base * x - gust * Math.cos(x);
  const integral = (end: number) => {
    let total = 0;
    for (const [a, b] of [
      [0, Math.PI + alpha],
      [period - alpha, period],
    ]) {
      const upper = Math.min(end, b);
      if (upper > a) total += primitive(upper) - primitive(a);
    }
    return total;
  };
  return (cycles * integral(period) + integral(phase)) / omega;
}
function fitCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  object: THREE.Object3D,
  view?: string,
) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3()),
    size = box.getSize(new THREE.Vector3());
  let direction = camera.position.clone().sub(controls.target).normalize();
  if (view) {
    const directions: Record<string, [number, number, number]> = {
      perspective: [-6, 3.6, 6],
      top: [0.001, 1, 0.001],
      side: [0, 0.08, 1],
      front: [-1, 0.06, 0],
    };
    direction = new THREE.Vector3(
      ...(directions[view] ?? directions.perspective),
    ).normalize();
  }
  const vfov = THREE.MathUtils.degToRad(camera.fov),
    hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const radius = Math.max(0.5, size.length() / 2);
  const distance = (radius / Math.sin(Math.min(vfov, hfov) / 2)) * 1.13;
  camera.position.copy(center).addScaledVector(direction, distance);
  camera.near = Math.max(0.02, distance / 1000);
  camera.far = Math.max(100, distance * 10);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.maxDistance = Math.max(25, distance * 4);
  controls.update();
}
function dispose(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material)
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(
        (m) => m.dispose(),
      );
  });
}
const Viewport = forwardRef<ViewportHandle, Props>(
  function Viewport(props, ref) {
    const host = useRef<HTMLDivElement>(null),
      current = useRef(props);
    current.current = props;
    const state = useRef<{
      renderer: THREE.WebGLRenderer;
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      controls: OrbitControls;
      transform: TransformControls;
      object: THREE.Group;
      grid: THREE.GridHelper;
      floor: THREE.Mesh;
      tunnel: THREE.Group;
      flow: THREE.Group;
      points: THREE.Points;
      paths: THREE.Vector3[][];
      baseMaterials: Map<THREE.Mesh, THREE.Material | THREE.Material[]>;
    } | null>(null);
    const [error, setError] = useState("");
    const setCamera = (view: string) => {
      const s = state.current;
      if (s) fitCamera(s.camera, s.controls, s.object, view);
    };
    useImperativeHandle(
      ref,
      () => ({
        resetCamera() {
          setCamera("perspective");
        },
        setCamera,
        zoom(factor) {
          const s = state.current;
          if (s) {
            s.camera.position
              .sub(s.controls.target)
              .multiplyScalar(factor)
              .add(s.controls.target);
            s.controls.update();
          }
        },
        screenshot() {
          const s = state.current;
          if (!s) return;
          s.renderer.render(s.scene, s.camera);
          const a = document.createElement("a");
          a.download = "aerolab-wind-tunnel.png";
          a.href = s.renderer.domElement.toDataURL("image/png");
          a.click();
        },
      }),
      [],
    );
    useEffect(() => {
      if (!host.current) return;
      const mount = host.current;
      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true,
        });
      } catch {
        setError(
          "The 3D viewport could not start. Enable WebGL or hardware acceleration in your browser, then reload.",
        );
        return;
      }
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setClearColor("#101817");
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;
      mount.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2("#101817", 0.025);
      const camera = new THREE.PerspectiveCamera(39, 1, 0.05, 100);
      camera.position.set(-6, 3.6, 6);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.065;
      controls.target.set(0, 0.65, 0);
      controls.minDistance = 2;
      controls.maxDistance = 22;
      controls.maxPolarAngle = Math.PI * 0.49;
      scene.add(new THREE.HemisphereLight("#d4f8f0", "#18231e", 1.35));
      const key = new THREE.DirectionalLight("#f5fff9", 2.7);
      key.position.set(1, 7, 4);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -7;
      key.shadow.camera.right = 7;
      key.shadow.camera.top = 7;
      key.shadow.camera.bottom = -7;
      key.shadow.bias = -0.0008;
      key.shadow.normalBias = 0.035;
      scene.add(key);
      const rim = new THREE.DirectionalLight("#96d9ee", 1.8);
      rim.position.set(-5, 3, -4);
      scene.add(rim);
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100),
        new THREE.MeshStandardMaterial({
          color: "#101a18",
          roughness: 0.92,
          metalness: 0.12,
        }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.035;
      floor.receiveShadow = true;
      scene.add(floor);
      const grid = new THREE.GridHelper(24, 48, "#2c4038", "#192a23");
      grid.position.y = -0.018;
      scene.add(grid);
      const tunnel = new THREE.Group();
      const frameMaterial = new THREE.LineBasicMaterial({
        color: "#365a50",
        transparent: true,
        opacity: 0.36,
      });
      const edge = new THREE.EdgesGeometry(new THREE.BoxGeometry(13, 4.5, 6));
      const outline = new THREE.LineSegments(edge, frameMaterial);
      outline.position.y = 2.2;
      tunnel.add(outline);
      scene.add(tunnel);
      const object = new THREE.Group(),
        flow = new THREE.Group();
      scene.add(object, flow);
      const pg = new THREE.BufferGeometry();
      const points = new THREE.Points(
        pg,
        new THREE.PointsMaterial({
          color: "#ffffff",
          vertexColors: true,
          size: 0.025,
          transparent: true,
          opacity: 0.7,
          sizeAttenuation: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      scene.add(points);
      const transform = new TransformControls(camera, renderer.domElement);
      transform.setSize(0.75);
      scene.add(transform.getHelper());
      transform.addEventListener("dragging-changed", (event) => {
        controls.enabled = !event.value;
      });
      transform.addEventListener("mouseUp", () => {
        const p = current.current;
        const selected = transform.object;
        if (!selected) return;
        const part = p.model.parts?.find(
          (v) => v.id === selected.userData.partId,
        );
        if (part)
          p.onPartChange({
            ...part,
            position: selected.position.toArray(),
            rotation: [
              selected.rotation.x,
              selected.rotation.y,
              selected.rotation.z,
            ].map(THREE.MathUtils.radToDeg) as [number, number, number],
            scale: selected.scale.toArray(),
          });
      });
      state.current = {
        renderer,
        scene,
        camera,
        controls,
        transform,
        object,
        grid,
        floor,
        tunnel,
        flow,
        points,
        paths: [],
        baseMaterials: new Map(),
      };
      const observer = new ResizeObserver(() => {
        const w = mount.clientWidth,
          h = mount.clientHeight;
        if (w && h) {
          renderer.setSize(w, h);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          if (state.current) fitCamera(camera, controls, state.current.object);
        }
      });
      observer.observe(mount);
      let down = new THREE.Vector2();
      const pointerDown = (e: PointerEvent) => {
        down.set(e.clientX, e.clientY);
      };
      const pointerUp = (e: PointerEvent) => {
        if (
          !current.current.editing ||
          down.distanceTo(new THREE.Vector2(e.clientX, e.clientY)) > 5 ||
          transform.dragging
        )
          return;
        const bounds = renderer.domElement.getBoundingClientRect();
        const pointer = new THREE.Vector2(
          ((e.clientX - bounds.left) / bounds.width) * 2 - 1,
          (-(e.clientY - bounds.top) / bounds.height) * 2 + 1,
        );
        const ray = new THREE.Raycaster();
        ray.setFromCamera(pointer, camera);
        const hit = ray
          .intersectObject(state.current!.object, true)
          .find((h) => h.object.userData.partId);
        current.current.onSelectPart(hit?.object.userData.partId ?? null);
      };
      renderer.domElement.addEventListener("pointerdown", pointerDown);
      renderer.domElement.addEventListener("pointerup", pointerUp);
      let frame = 0,
        last = performance.now(),
        frames = 0,
        lastDistance = -1,
        lastArray: unknown = null;
      const animate = () => {
        frame = requestAnimationFrame(animate);
        const s = state.current;
        if (!s) return;
        const p = current.current;
        s.grid.visible = p.showGrid;
        s.tunnel.visible = p.showTunnel;
        const distance = windDistance(p.settings, p.time);
        const arr = s.points.geometry.getAttribute("position");
        if (arr && (distance !== lastDistance || arr !== lastArray)) {
          lastDistance = distance;
          lastArray = arr;
          const coords = arr.array as Float32Array;
          const colorAttribute = s.points.geometry.getAttribute("color");
          const particleColors = colorAttribute?.array as
            | Float32Array
            | undefined;
          const n = s.paths.length;
          for (let i = 0; i < coords.length / 3; i++) {
            const path = s.paths[i % n];
            if (!path) continue;
            const t = (((distance * 0.028 + i * 0.61803398875) % 1) + 1) % 1;
            const f = t * (path.length - 1),
              j = Math.floor(f),
              a = path[j],
              b = path[Math.min(j + 1, path.length - 1)];
            coords[i * 3] = THREE.MathUtils.lerp(a.x, b.x, f - j);
            coords[i * 3 + 1] = THREE.MathUtils.lerp(a.y, b.y, f - j);
            coords[i * 3 + 2] = THREE.MathUtils.lerp(a.z, b.z, f - j);
            if (particleColors) {
              const line = s.flow.children[i % n] as THREE.Line;
              const lineColors = line.geometry.getAttribute("color").array;
              for (let channel = 0; channel < 3; channel++)
                particleColors[i * 3 + channel] = THREE.MathUtils.lerp(
                  lineColors[j * 3 + channel],
                  lineColors[Math.min(j + 1, path.length - 1) * 3 + channel],
                  f - j,
                );
            }
          }
          arr.needsUpdate = true;
          if (colorAttribute) colorAttribute.needsUpdate = true;
        }
        const hasWind = effectiveSpeed(p.settings, p.time) > 0.001;
        s.points.visible = p.mode !== "pressure" && hasWind;
        s.flow.visible = p.mode !== "particles" && hasWind;
        controls.update();
        renderer.render(scene, camera);
        frames++;
        const now = performance.now();
        if (now - last > 700) {
          p.onStats?.({
            fps: Math.round((frames * 1000) / (now - last)),
            triangles: renderer.info.render.triangles,
          });
          frames = 0;
          last = now;
        }
      };
      animate();
      const contextLost = (e: Event) => {
        e.preventDefault();
        setError(
          "The graphics context was lost. Reload to restore the 3D viewport.",
        );
      };
      renderer.domElement.addEventListener("webglcontextlost", contextLost);
      return () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        controls.dispose();
        transform.dispose();
        state.current?.baseMaterials.forEach((material) =>
          (Array.isArray(material) ? material : [material]).forEach((m) =>
            m.dispose(),
          ),
        );
        dispose(scene);
        renderer.dispose();
        renderer.domElement.remove();
        state.current = null;
      };
    }, []);
    useEffect(() => {
      const s = state.current;
      if (!s) return;
      s.transform.detach();
      s.baseMaterials.forEach((material) =>
        (Array.isArray(material) ? material : [material]).forEach((m) =>
          m.dispose(),
        ),
      );
      dispose(s.object);
      s.scene.remove(s.object);
      try {
        s.object = buildModel(props.model);
        setError("");
      } catch (e) {
        setError((e as Error).message);
        return;
      }
      s.object.scale.setScalar(props.settings.scale);
      s.object.rotation.y = THREE.MathUtils.degToRad(props.settings.yaw);
      s.object.rotation.z = THREE.MathUtils.degToRad(props.settings.pitch);
      s.scene.add(s.object);
      fitCamera(s.camera, s.controls, s.object);
      const objectBounds = new THREE.Box3().setFromObject(s.object),
        extent = objectBounds.getSize(new THREE.Vector3()),
        objectCenter = objectBounds.getCenter(new THREE.Vector3());
      s.floor.position.set(
        objectCenter.x,
        objectBounds.min.y - 0.035,
        objectCenter.z,
      );
      s.grid.position.set(
        objectCenter.x,
        objectBounds.min.y - 0.018,
        objectCenter.z,
      );
      s.tunnel.position.set(objectCenter.x, objectBounds.min.y, objectCenter.z);
      s.tunnel.scale.set(
        Math.max(1, extent.x / 10),
        Math.max(1, extent.y / 3.8),
        Math.max(1, extent.z / 5),
      );
      s.baseMaterials.clear();
      s.object.traverse((o) => {
        if (o instanceof THREE.Mesh) s.baseMaterials.set(o, o.material);
      });
    }, [
      props.model,
      props.settings.scale,
      props.settings.yaw,
      props.settings.pitch,
    ]);
    useEffect(() => {
      const s = state.current;
      if (!s) return;
      dispose(s.flow);
      s.flow.clear();
      const paths: THREE.Vector3[][] = [];
      const bounds = new THREE.Box3().setFromObject(s.object),
        size = bounds.getSize(new THREE.Vector3());
      const radius = Math.max(0.5, size.z / 2 + 0.2);
      const height = Math.max(0.8, size.y);
      const center = bounds.getCenter(new THREE.Vector3());
      const halfLength = Math.max(0.8, size.x / 2 + 0.2),
        domain = Math.max(7, size.x * 0.95),
        spread = Math.max(3.4, radius * 1.8),
        cx = center.x,
        cz = center.z;
      const rows = Math.min(
          14,
          Math.max(7, Math.round(7 + props.density * 0.8)),
        ),
        layers = 4;
      const envelopeModel = {
          ...props.model,
          parts: undefined,
          dimensions: modelDimensions(props.model),
        },
        centerY = center.y,
        freestream = Math.max(
          0.001,
          effectiveSpeed(props.settings, props.time),
        );
      for (let layer = 0; layer < layers; layer++)
        for (let row = 0; row < rows; row++) {
          const z = (row / (rows - 1) - 0.5) * spread * 2,
            y = bounds.min.y + 0.25 + layer * Math.max(0.68, height / 3.2);
          const path: THREE.Vector3[] = [];
          const near = Math.abs(z) < radius + 0.2 && y < bounds.max.y + 0.2;
          const goesAbove = Math.abs(z) < radius * 0.5;
          for (let j = 0; j <= 100; j++) {
            const localX = -domain + (j * domain) / 50;
            const outside = Math.max(0, Math.abs(localX) - halfLength);
            const envelope = Math.exp(
              -Math.pow(outside / Math.max(1.25, halfLength * 0.72), 2),
            );
            const side =
              near && !goesAbove
                ? Math.sign(z || 1) *
                  Math.max(0, radius + 0.25 - Math.abs(z)) *
                  envelope
                : 0;
            const lift =
              near && goesAbove
                ? Math.max(0, bounds.max.y + 0.28 - y) * envelope
                : 0;
            const wake =
              Math.max(0, localX - halfLength) *
              0.018 *
              Math.sin(localX * 1.8 + layer + row) *
              props.settings.turbulence;
            path.push(
              new THREE.Vector3(
                localX + cx,
                y + lift + Math.abs(wake),
                cz + z + side + wake,
              ),
            );
          }
          paths.push(path);
          const geometry = new THREE.BufferGeometry().setFromPoints(path);
          const colors = new Float32Array(path.length * 3);
          path.forEach((point, i) => {
            const v = flowVelocity(
              [point.x - cx, point.y - centerY, point.z - cz],
              envelopeModel,
              props.settings,
              props.time,
            );
            const ratio = Math.min(1.4, Math.hypot(...v) / freestream);
            const cp = Math.max(-1, Math.min(1, 1 - ratio * ratio));
            const hue =
              props.mode === "pressure"
                ? 0.32 - cp * 0.28
                : 0.54 - Math.min(1, ratio / 1.4) * 0.38;
            const color = new THREE.Color().setHSL(hue, 0.6, 0.52);
            colors.set([color.r, color.g, color.b], i * 3);
          });
          geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
          const line = new THREE.Line(
            geometry,
            new THREE.LineBasicMaterial({
              vertexColors: true,
              transparent: true,
              opacity: layer === 0 ? 0.12 : 0.25,
              depthWrite: false,
            }),
          );
          s.flow.add(line);
        }
      s.paths = paths;
      const count = paths.length * (props.mode === "particles" ? 12 : 3);
      s.points.geometry.dispose();
      s.points.geometry = new THREE.BufferGeometry();
      s.points.geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(count * 3), 3),
      );
      s.points.geometry.setAttribute(
        "color",
        new THREE.BufferAttribute(new Float32Array(count * 3), 3),
      );
    }, [
      props.model,
      props.density,
      props.settings.scale,
      props.settings.yaw,
      props.settings.pitch,
      props.settings.turbulence,
      props.settings.speed,
      props.settings.gust,
      props.settings.gustFrequency,
      props.mode,
    ]);
    useEffect(() => {
      const s = state.current;
      if (!s) return;
      s.transform.detach();
      s.transform.setMode(props.transformMode);
      s.object.updateMatrixWorld(true);
      const envelopeModel = {
        ...props.model,
        parts: undefined,
        dimensions: modelDimensions(props.model),
      };
      const center = new THREE.Box3()
        .setFromObject(s.object)
        .getCenter(new THREE.Vector3());
      s.object.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const base = s.baseMaterials.get(o);
          if (base) {
            if (o.material !== base)
              (Array.isArray(o.material) ? o.material : [o.material]).forEach(
                (m) => m.dispose(),
              );
            o.material = base;
          }
          if (props.mode === "pressure" || props.mode === "velocity") {
            const geo = o.geometry;
            const pos = geo.getAttribute("position");
            const normalMatrix = new THREE.Matrix3().getNormalMatrix(
              o.matrixWorld,
            );
            if (pos) {
              const colors = new Float32Array(pos.count * 3);
              for (let i = 0; i < pos.count; i++) {
                const world = new THREE.Vector3()
                  .fromBufferAttribute(pos, i)
                  .applyMatrix4(o.matrixWorld);
                const v = flowVelocity(
                  [world.x - center.x, world.y - center.y, world.z - center.z],
                  envelopeModel,
                  props.settings,
                  props.time,
                );
                const ratio = Math.min(
                  1.4,
                  Math.hypot(...v) /
                    Math.max(0.001, effectiveSpeed(props.settings, props.time)),
                );
                const normals = geo.getAttribute("normal");
                const nx = normals
                  ? new THREE.Vector3()
                      .fromBufferAttribute(normals, i)
                      .applyMatrix3(normalMatrix)
                      .normalize().x
                  : 0;
                const cp =
                  effectiveSpeed(props.settings, props.time) > 0.001
                    ? Math.max(
                        -1,
                        Math.min(
                          1,
                          1 - ratio * ratio + Math.max(0, -nx) * 0.45,
                        ),
                      )
                    : 0;
                const hue =
                  props.mode === "pressure"
                    ? 0.32 - cp * 0.28
                    : 0.64 - Math.min(1, ratio / 1.25) * 0.48;
                const c = new THREE.Color().setHSL(hue, 0.68, 0.49);
                colors.set([c.r, c.g, c.b], i * 3);
              }
              geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
              o.material = new THREE.MeshStandardMaterial({
                vertexColors: true,
                metalness: 0.25,
                roughness: 0.43,
              });
            }
          }
          if (props.editing && o.userData.partId === props.selectedPartId)
            s.transform.attach(o);
        }
      });
      s.transform.enabled = props.editing;
    }, [
      props.model,
      props.mode,
      props.editing,
      props.selectedPartId,
      props.transformMode,
      props.settings.speed,
      props.settings.scale,
      props.settings.yaw,
      props.settings.pitch,
      props.settings.gust,
      props.settings.gustFrequency,
      props.settings.turbulence,
    ]);
    return (
      <div
        ref={host}
        className="viewport-canvas"
        style={{ position: "absolute", inset: 0, overflow: "hidden" }}
        aria-label="Interactive three-dimensional wind tunnel. Drag to orbit, scroll to zoom."
      >
        {error && (
          <div
            role="alert"
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              padding: 40,
              background: "#101817",
              color: "#d7ece1",
              zIndex: 2,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}
      </div>
    );
  },
);
export default Viewport;
