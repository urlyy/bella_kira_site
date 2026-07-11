import * as THREE from "three";
import { MMDLoader } from "three/examples/jsm/loaders/MMDLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const canvas = document.querySelector<HTMLCanvasElement>("#model-canvas");
const loading = document.querySelector<HTMLElement>("#model-loading");
const progress = document.querySelector<HTMLElement>("#model-progress");
const error = document.querySelector<HTMLElement>("#model-error");

type Axis = "x" | "y" | "z";
type Angles = Record<Axis, number>;
type Pose = Record<string, Partial<Angles>>;
type Grant = {
  index: number;
  parentIndex: number;
  ratio: number;
  isLocal: boolean;
  affectRotation: boolean;
  affectPosition: boolean;
};

const partLabels: Record<string, string> = {
  頭: "头部", 上半身2: "上身", 左腕: "左上臂", 右腕: "右上臂",
  左ひじ: "左小臂", 右ひじ: "右小臂", 左手首: "左手腕", 右手首: "右手腕",
  左足: "左腿", 右足: "右腿", 左ひざ: "左膝", 右ひざ: "右膝",
};

const presets: Record<string, Pose> = {
  natural: {},
  wave: {
    上半身2: { y: -5, z: 3 }, 頭: { y: 8, z: -3 },
    右腕: { x: -12, z: -118 }, 右ひじ: { x: -15, z: -52 }, 右手首: { x: 8, z: -14 },
    左腕: { z: -12 }, 左ひじ: { z: 10 },
  },
  cheer: {
    上半身2: { x: -5 }, 頭: { x: 5 },
    左腕: { x: -8, z: 116 }, 右腕: { x: -8, z: -116 },
    左ひじ: { z: 18 }, 右ひじ: { z: -18 },
    左足: { x: -8, z: -4 }, 右足: { x: 5, z: 5 }, 右ひざ: { x: 10 },
  },
  dance: {
    上半身2: { x: -7, y: 12, z: -8 }, 頭: { y: -15, z: 7 },
    左腕: { x: -24, y: 8, z: 62 }, 左ひじ: { x: -8, z: 38 }, 左手首: { y: 16 },
    右腕: { x: 12, y: -8, z: -38 }, 右ひじ: { x: -10, z: -62 }, 右手首: { y: -12 },
    左足: { x: -12, z: -5 }, 右足: { x: 18, z: 9 }, 右ひざ: { x: 24 },
  },
};

const poseState = new Map<string, Angles>();
const bones = new Map<string, THREE.Bone>();
const baseQuaternions = new Map<string, THREE.Quaternion>();
let grants: Grant[] = [];
let model: THREE.SkinnedMesh | null = null;
let skeletonHelper: THREE.SkeletonHelper | null = null;
let skeletonNodes: THREE.Points | null = null;
let selectedBoneMarker: THREE.Mesh | null = null;
let selectedBoneLinks: THREE.LineSegments | null = null;
let selectedBone = "頭";
let advancedMode = false;
const boneWorldPosition = new THREE.Vector3();
const projectedBonePosition = new THREE.Vector3();

const blankAngles = (): Angles => ({ x: 0, y: 0, z: 0 });
const getAngles = (name: string) => poseState.get(name) ?? blankAngles();
const updateSkeletonVisibility = () => {
  if (skeletonHelper) skeletonHelper.visible = advancedMode;
  if (skeletonNodes) skeletonNodes.visible = advancedMode;
  if (selectedBoneMarker) selectedBoneMarker.visible = advancedMode;
  if (selectedBoneLinks) selectedBoneLinks.visible = advancedMode;
  const label = document.querySelector<HTMLElement>("#selected-bone-label");
  if (label) label.hidden = !advancedMode;
};
const applyBoneOffset = (name: string) => {
  const bone = bones.get(name);
  const base = baseQuaternions.get(name);
  if (!bone || !base) return;
  const value = getAngles(name);
  const offset = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(value.x), THREE.MathUtils.degToRad(value.y), THREE.MathUtils.degToRad(value.z), "XYZ"
  ));
  bone.quaternion.copy(base).multiply(offset);
};

const rebuildSkeleton = () => {
  if (!model) return;
  bones.forEach((bone, name) => {
    const base = baseQuaternions.get(name);
    if (base) bone.quaternion.copy(base);
  });
  poseState.forEach((_angles, name) => applyBoneOffset(name));

  const byIndex = new Map(grants.map((grant) => [grant.index, grant]));
  const applied = new Set<number>();
  const applying = new Set<number>();
  const applyGrant = (grant: Grant) => {
    if (applied.has(grant.index) || applying.has(grant.index)) return;
    applying.add(grant.index);
    const parentGrant = byIndex.get(grant.parentIndex);
    if (parentGrant) applyGrant(parentGrant);
    const bone = model?.skeleton.bones[grant.index];
    const parent = model?.skeleton.bones[grant.parentIndex];
    if (bone && parent && grant.affectRotation && !grant.isLocal) {
      const parentBase = baseQuaternions.get(parent.name) ?? new THREE.Quaternion();
      const delta = parentBase.clone().invert().multiply(parent.quaternion);
      const inherited = new THREE.Quaternion().slerp(delta, grant.ratio);
      bone.quaternion.multiply(inherited);
    }
    applying.delete(grant.index);
    applied.add(grant.index);
  };
  grants.forEach(applyGrant);
  model.updateMatrixWorld(true);
  if (skeletonNodes) {
    const positions = skeletonNodes.geometry.getAttribute("position") as THREE.BufferAttribute;
    model.skeleton.bones.forEach((bone, index) => {
      bone.getWorldPosition(boneWorldPosition);
      positions.setXYZ(index, boneWorldPosition.x, boneWorldPosition.y, boneWorldPosition.z);
    });
    positions.needsUpdate = true;
    skeletonNodes.geometry.computeBoundingSphere();
  }
};

const sliders = [...document.querySelectorAll<HTMLInputElement>("#rotation-controls input[type=range]")];
const syncSliders = () => {
  const values = getAngles(selectedBone);
  sliders.forEach((input) => {
    const axis = input.dataset.axis as Axis;
    input.value = String(values[axis]);
    const output = input.parentElement?.querySelector("output");
    if (output) output.textContent = `${Math.round(values[axis])}°`;
  });
  const label = document.querySelector<HTMLElement>("#selected-part");
  if (label) label.textContent = advancedMode ? selectedBone : (partLabels[selectedBone] ?? selectedBone);
  document.querySelectorAll("#body-parts button").forEach((button) => {
    button.classList.toggle("is-active", (button as HTMLElement).dataset.bone === selectedBone);
  });
  document.querySelectorAll("#bone-list button").forEach((button) => {
    button.classList.toggle("is-active", (button as HTMLElement).dataset.bone === selectedBone);
    button.setAttribute("aria-selected", String((button as HTMLElement).dataset.bone === selectedBone));
  });
  const floatingLabel = document.querySelector<HTMLElement>("#selected-bone-label");
  const index = model?.skeleton.bones.findIndex((bone) => bone.name === selectedBone) ?? -1;
  const floatingName = floatingLabel?.querySelector("span");
  const floatingIndex = floatingLabel?.querySelector("small");
  if (floatingName) floatingName.textContent = selectedBone;
  if (floatingIndex) floatingIndex.textContent = index >= 0 ? `#${String(index).padStart(3, "0")}` : "";
};

const applyPose = (pose: Pose) => {
  poseState.clear();
  Object.entries(pose).forEach(([name, values]) => poseState.set(name, { ...blankAngles(), ...values }));
  rebuildSkeleton();
  syncSliders();
};

const renderBoneList = (query = "") => {
  const list = document.querySelector<HTMLElement>("#bone-list");
  if (!list || !model) return;
  const normalized = query.trim().toLocaleLowerCase();
  const fragment = document.createDocumentFragment();
  model.skeleton.bones.forEach((bone, index) => {
    if (normalized && !`${bone.name} ${index}`.toLocaleLowerCase().includes(normalized)) return;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.bone = bone.name;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(bone.name === selectedBone));
    button.innerHTML = `<span>${bone.name || "未命名骨骼"}</span><small>#${String(index).padStart(3, "0")}</small>`;
    fragment.append(button);
  });
  list.replaceChildren(fragment);
};

const clearExpressions = () => {
  if (!model?.morphTargetInfluences) return;
  model.morphTargetInfluences.fill(0);
};

const setExpression = (kind: string) => {
  if (!model?.morphTargetDictionary || !model.morphTargetInfluences) return;
  clearExpressions();
  const names: Record<string, Array<[string, number]>> = {
    smile: [["にこり", .75], ["口角上げ", .7], ["cheek", .25]],
    wink: [["ウィンク", 1], ["口角上げ", .65]],
    surprise: [["びっくり", .85], ["お", .35]],
  };
  (names[kind] ?? []).forEach(([name, weight]) => {
    const index = model?.morphTargetDictionary?.[name];
    if (index !== undefined && model?.morphTargetInfluences) model.morphTargetInfluences[index] = weight;
  });
};

if (canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x17102c, 0.018);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  camera.position.set(0, 12, 38);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 10, 0);
  controls.enableDamping = true;
  controls.minDistance = 12;
  controls.maxDistance = 65;
  controls.maxPolarAngle = Math.PI * 0.88;

  scene.add(new THREE.HemisphereLight(0xf5eaff, 0x241632, 2.5));
  const key = new THREE.DirectionalLight(0xffd7d1, 4);
  key.position.set(8, 18, 12);
  scene.add(key);
  const rim = new THREE.PointLight(0x9d79ff, 80, 40);
  rim.position.set(-9, 13, -8);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(16, 96),
    new THREE.MeshStandardMaterial({ color: 0x3c2855, roughness: 0.55, metalness: 0.3, transparent: true, opacity: 0.68 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  new MMDLoader().load(
    "/assets/mmd_model/%E8%B4%9D%E6%8B%89/BeiLa.pmx",
    (mesh: THREE.SkinnedMesh) => {
      mesh.traverse((child: THREE.Object3D) => { if (child instanceof THREE.Mesh) child.castShadow = true; });
      model = mesh;
      mesh.skeleton.bones.forEach((bone) => {
        bones.set(bone.name, bone);
        baseQuaternions.set(bone.name, bone.quaternion.clone());
      });
      grants = (mesh.geometry.userData.MMD?.grants ?? []) as Grant[];
      scene.add(mesh);

      skeletonHelper = new THREE.SkeletonHelper(mesh);
      const helperMaterial = skeletonHelper.material as THREE.LineBasicMaterial;
      helperMaterial.transparent = true;
      helperMaterial.opacity = .82;
      helperMaterial.depthTest = false;
      helperMaterial.depthWrite = false;
      helperMaterial.blending = THREE.AdditiveBlending;
      skeletonHelper.renderOrder = 40;
      const helperColors = skeletonHelper.geometry.getAttribute("color") as THREE.BufferAttribute;
      for (let index = 0; index < helperColors.count; index += 1) {
        const color = index % 2 === 0 ? new THREE.Color(0xe8d6ff) : new THREE.Color(0xffa49d);
        helperColors.setXYZ(index, color.r, color.g, color.b);
      }
      helperColors.needsUpdate = true;
      scene.add(skeletonHelper);

      skeletonNodes = new THREE.Points(
        new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(mesh.skeleton.bones.length * 3), 3)),
        new THREE.PointsMaterial({ color: 0xffd8cf, size: .095, sizeAttenuation: true, transparent: true, opacity: .86, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      skeletonNodes.frustumCulled = false;
      skeletonNodes.renderOrder = 41;
      scene.add(skeletonNodes);

      selectedBoneMarker = new THREE.Mesh(
        new THREE.SphereGeometry(.18, 18, 12),
        new THREE.MeshBasicMaterial({ color: 0xffe59a, transparent: true, opacity: .98, depthTest: false, depthWrite: false })
      );
      selectedBoneMarker.renderOrder = 42;
      scene.add(selectedBoneMarker);

      selectedBoneLinks = new THREE.LineSegments(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: 0xffe59a, transparent: true, opacity: .95, depthTest: false, depthWrite: false })
      );
      (selectedBoneLinks.material as THREE.LineBasicMaterial).blending = THREE.AdditiveBlending;
      selectedBoneLinks.renderOrder = 43;
      scene.add(selectedBoneLinks);
      updateSkeletonVisibility();
      loading?.classList.add("is-done");
      document.querySelector("#pose-panel")?.classList.add("is-ready");
      applyPose(presets.natural);
      renderBoneList();
      const count = document.querySelector("#bone-count");
      if (count) count.textContent = `${mesh.skeleton.bones.length} 根`;
      syncSliders();
      try {
        if (!sessionStorage.getItem("bella-pose-help-seen")) {
          (document.querySelector("#stage-help") as HTMLDialogElement | null)?.showModal();
          sessionStorage.setItem("bella-pose-help-seen", "1");
        }
      } catch { /* Storage may be unavailable; the help button remains visible. */ }
    },
    (event: ProgressEvent<EventTarget>) => {
      if (progress && event.total) progress.textContent = `${Math.round(event.loaded / event.total * 100)}%`;
    },
    () => {
      loading?.setAttribute("hidden", "");
      if (error) error.hidden = false;
    }
  );

  const resize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  renderer.setAnimationLoop(() => {
    controls.update();
    if (advancedMode && model && selectedBoneMarker && selectedBoneLinks) {
      const bone = bones.get(selectedBone);
      if (bone) {
        bone.getWorldPosition(boneWorldPosition);
        selectedBoneMarker.position.copy(boneWorldPosition);
        const points: THREE.Vector3[] = [];
        if (bone.parent instanceof THREE.Bone) {
          points.push(boneWorldPosition.clone(), bone.parent.getWorldPosition(new THREE.Vector3()));
        }
        bone.children.forEach((child) => {
          if (child instanceof THREE.Bone) points.push(boneWorldPosition.clone(), child.getWorldPosition(new THREE.Vector3()));
        });
        selectedBoneLinks.geometry.setFromPoints(points);

        projectedBonePosition.copy(boneWorldPosition).project(camera);
        const label = document.querySelector<HTMLElement>("#selected-bone-label");
        const isOnScreen = projectedBonePosition.z > -1 && projectedBonePosition.z < 1;
        if (label) {
          label.hidden = !isOnScreen;
          if (isOnScreen) {
            label.style.left = `${(projectedBonePosition.x * .5 + .5) * canvas.clientWidth}px`;
            label.style.top = `${(-projectedBonePosition.y * .5 + .5) * canvas.clientHeight}px`;
          }
        }
      }
    }
    renderer.render(scene, camera);
  });
}

document.querySelectorAll<HTMLButtonElement>("#body-parts button").forEach((button) => {
  button.addEventListener("click", () => {
    selectedBone = button.dataset.bone ?? "頭";
    syncSliders();
  });
});

sliders.forEach((input) => {
  input.addEventListener("input", () => {
    const values = { ...getAngles(selectedBone) };
    values[input.dataset.axis as Axis] = Number(input.value);
    poseState.set(selectedBone, values);
    rebuildSkeleton();
    const output = input.parentElement?.querySelector("output");
    if (output) output.textContent = `${input.value}°`;
  });
});

document.querySelectorAll<HTMLButtonElement>("#pose-presets button").forEach((button) => {
  button.addEventListener("click", () => {
    const name = button.dataset.preset ?? "natural";
    applyPose(presets[name]);
    document.querySelectorAll("#pose-presets button").forEach((item) => item.classList.toggle("is-active", item === button));
  });
});

document.querySelectorAll<HTMLButtonElement>("#expressions button").forEach((button) => {
  button.addEventListener("click", () => {
    setExpression(button.dataset.expression ?? "clear");
    document.querySelectorAll("#expressions button").forEach((item) => item.classList.toggle("is-active", item === button));
  });
});

document.querySelector("#reset-part")?.addEventListener("click", () => {
  poseState.delete(selectedBone);
  rebuildSkeleton();
  syncSliders();
});

document.querySelector("#bone-search")?.addEventListener("input", (event) => {
  renderBoneList((event.target as HTMLInputElement).value);
});
document.querySelector("#bone-list")?.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-bone]");
  if (!button?.dataset.bone) return;
  selectedBone = button.dataset.bone;
  syncSliders();
});
document.querySelectorAll<HTMLButtonElement>(".editor-modes button").forEach((button) => {
  button.addEventListener("click", () => {
    advancedMode = button.dataset.mode === "advanced";
    posePanel?.classList.toggle("is-advanced", advancedMode);
    updateSkeletonVisibility();
    document.querySelectorAll(".editor-modes button").forEach((item) => item.classList.toggle("is-active", item === button));
    if (!advancedMode && !partLabels[selectedBone]) selectedBone = "頭";
    const selectedKind = document.querySelector("#selected-kind");
    if (selectedKind) selectedKind.textContent = advancedMode ? "当前骨骼" : "当前部位";
    document.querySelectorAll<HTMLElement>("#rotation-controls label > span").forEach((label) => {
      label.textContent = advancedMode ? (label.dataset.advanced ?? "") : (label.dataset.easy ?? "");
    });
    sliders.forEach((input) => {
      input.min = advancedMode ? "-180" : "-120";
      input.max = advancedMode ? "180" : "120";
    });
    renderBoneList((document.querySelector("#bone-search") as HTMLInputElement | null)?.value ?? "");
    syncSliders();
  });
});
document.querySelector("#reset-all")?.addEventListener("click", () => {
  applyPose(presets.natural);
  clearExpressions();
  document.querySelectorAll(".pose-panel .is-active").forEach((item) => item.classList.remove("is-active"));
});

const help = document.querySelector<HTMLDialogElement>("#stage-help");
const closeHelp = () => help?.close();
document.querySelector("#help-open")?.addEventListener("click", () => help?.showModal());
document.querySelector("#help-close")?.addEventListener("click", closeHelp);
document.querySelector("#help-start")?.addEventListener("click", closeHelp);
help?.addEventListener("click", (event) => { if (event.target === help) closeHelp(); });

const toggle = document.querySelector<HTMLButtonElement>("#pose-toggle");
const posePanel = document.querySelector("#pose-panel");
if (matchMedia("(max-width: 900px)").matches) {
  posePanel?.classList.add("is-collapsed");
  toggle?.setAttribute("aria-expanded", "false");
  if (toggle) toggle.textContent = "打开姿态编辑";
}
toggle?.addEventListener("click", () => {
  const collapsed = posePanel?.classList.toggle("is-collapsed") ?? false;
  toggle.setAttribute("aria-expanded", String(!collapsed));
  toggle.textContent = collapsed ? "打开姿态编辑" : "姿态编辑";
});
