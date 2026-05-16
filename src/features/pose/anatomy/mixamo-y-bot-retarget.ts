import { Bone, Matrix4, Object3D, Quaternion, Vector3 } from "three";
import { LM } from "../lib/topology";
import { VISIBILITY_THRESHOLD } from "../lib/draw-stick-figure";

/** Mixamo bone name cores (`mixamorig:` or `mixamorig` + optional `_NNN` suffix in many GLBs). */
export const MIXAMO = {
  HIPS: "Hips",
  SPINE: "Spine",
  SPINE1: "Spine1",
  SPINE2: "Spine2",
  NECK: "Neck",
  HEAD: "Head",
  LEFT_SHOULDER: "LeftShoulder",
  LEFT_ARM: "LeftArm",
  LEFT_FORE_ARM: "LeftForeArm",
  RIGHT_SHOULDER: "RightShoulder",
  RIGHT_ARM: "RightArm",
  RIGHT_FORE_ARM: "RightForeArm",
  LEFT_UP_LEG: "LeftUpLeg",
  LEFT_LEG: "LeftLeg",
  LEFT_FOOT: "LeftFoot",
  RIGHT_UP_LEG: "RightUpLeg",
  RIGHT_LEG: "RightLeg",
  RIGHT_FOOT: "RightFoot",
} as const;

const MIXAMO_PREFIX_COLON = "mixamorig:";
/** GLTFLoader / Three sanitize `:` in node names, so many files use `mixamorigHips_01`. */
const MIXAMO_PREFIX_FLAT = "mixamorig";

/**
 * Resolve a Mixamo bone by logical core name. Many GLB exports use suffixed names
 * (`mixamorig:Hips_01`, `mixamorig:LeftArm_011`) instead of plain `mixamorig:Hips`.
 * Three's GLTFLoader also emits **colon-free** names (`mixamorigHips_01`).
 */
export function resolveMixamoBone(
  map: Map<string, Bone>,
  core: string,
): Bone | undefined {
  const exactColon = `${MIXAMO_PREFIX_COLON}${core}`;
  const exactFlat = `${MIXAMO_PREFIX_FLAT}${core}`;
  const hit = map.get(exactColon) ?? map.get(exactFlat);
  if (hit) return hit;

  const suffixColon = `${exactColon}_`;
  const suffixFlat = `${exactFlat}_`;
  let chosen: string | undefined;
  for (const name of map.keys()) {
    if (!name.startsWith(suffixColon) && !name.startsWith(suffixFlat)) continue;
    if (!chosen || name.length < chosen.length) chosen = name;
  }
  return chosen ? map.get(chosen) : undefined;
}

export interface BoneRetargetMeta {
  bindQuat: Quaternion;
  /** Unit direction from joint to first child bone, in this bone's local space (bind pose). */
  restForward: Vector3 | null;
  /**
   * Unit direction from this bone's head to its first child bone's head, in **this bone's
   * parent's** local space at bind pose. Matches the space used for MediaPipe segment dirs,
   * so alignment stays correct when bind rotations are not identity.
   */
  tailBindParentDir: Vector3 | null;
}

export interface RetargetScratch {
  invParent: Matrix4;
  v0: Vector3;
  v1: Vector3;
  dir: Vector3;
  hipMid: Vector3;
  shoulderMid: Vector3;
  across: Vector3;
  forward: Vector3;
  up: Vector3;
  right: Vector3;
  m: Matrix4;
  q: Quaternion;
  qAlign: Quaternion;
}

export function createRetargetScratch(): RetargetScratch {
  return {
    invParent: new Matrix4(),
    v0: new Vector3(),
    v1: new Vector3(),
    dir: new Vector3(),
    hipMid: new Vector3(),
    shoulderMid: new Vector3(),
    across: new Vector3(),
    forward: new Vector3(),
    up: new Vector3(),
    right: new Vector3(),
    m: new Matrix4(),
    q: new Quaternion(),
    qAlign: new Quaternion(),
  };
}

function visOk(visibility: number[], i: number): boolean {
  return (visibility[i] ?? 1) >= VISIBILITY_THRESHOLD;
}

export function collectBones(root: Object3D): Map<string, Bone> {
  const map = new Map<string, Bone>();
  root.traverse((o) => {
    if ((o as Bone).isBone) map.set(o.name, o as Bone);
  });
  return map;
}

const _bw = new Vector3();
const _cw = new Vector3();
const _v0 = new Vector3();
const _v1 = new Vector3();

/**
 * Store bind rotation, local rest forward, and tail direction in **parent bone space**
 * at bind pose (matches segment math in {@link alignAxisInParent}).
 */
export function captureBoneRetargetMeta(bones: Iterable<Bone>): void {
  for (const bone of bones) {
    const child = bone.children.find((c) => (c as Bone).isBone) as Bone | undefined;
    let restForward: Vector3 | null = null;
    if (child) {
      const v = new Vector3(child.position.x, child.position.y, child.position.z);
      if (v.lengthSq() > 1e-10) restForward = v.normalize();
    }

    let tailBindParentDir: Vector3 | null = null;
    if (child && bone.parent) {
      bone.updateMatrixWorld(true);
      child.updateMatrixWorld(true);
      bone.getWorldPosition(_bw);
      child.getWorldPosition(_cw);
      bone.parent.updateMatrixWorld(true);
      const invParent = new Matrix4().copy(bone.parent.matrixWorld).invert();
      _v0.copy(_bw).applyMatrix4(invParent);
      _v1.copy(_cw).applyMatrix4(invParent);
      const d = new Vector3().subVectors(_v1, _v0);
      if (d.lengthSq() > 1e-10) tailBindParentDir = d.clone().normalize();
    }

    (bone.userData as { retarget?: BoneRetargetMeta }).retarget = {
      bindQuat: bone.quaternion.clone(),
      restForward,
      tailBindParentDir,
    };
  }
}

export function resetBonesToBind(skeletonBones: Bone[]): void {
  for (const bone of skeletonBones) {
    const r = (bone.userData as { retarget?: BoneRetargetMeta }).retarget;
    if (r?.bindQuat) bone.quaternion.copy(r.bindQuat);
  }
}

/** World / low-confidence streams: hips often sit below draw threshold but are still usable. */
const HIP_GATE_VISIBILITY = 0.05;

export function computeHipMid(
  points: Vector3[],
  visibility: number[],
  out: Vector3,
): boolean {
  const lh = points[LM.LEFT_HIP];
  const rh = points[LM.RIGHT_HIP];
  if (!lh || !rh) return false;
  const visLh = visibility[LM.LEFT_HIP] ?? 1;
  const visRh = visibility[LM.RIGHT_HIP] ?? 1;
  if (visLh < HIP_GATE_VISIBILITY || visRh < HIP_GATE_VISIBILITY) return false;
  out.copy(lh).add(rh).multiplyScalar(0.5);
  return true;
}

/**
 * Root orientation: horizontal "across" blends shoulder line and hip line (XZ),
 * then forward = cross(across, worldUp) so the mesh faces the same way as the stick torso.
 */
export function computeRootFacingQuaternion(
  points: Vector3[],
  visibility: number[],
  s: RetargetScratch,
): Quaternion | null {
  s.up.set(0, 1, 0);

  let shoulderAcross: Vector3 | null = null;
  const ls = points[LM.LEFT_SHOULDER];
  const rs = points[LM.RIGHT_SHOULDER];
  if (
    ls &&
    rs &&
    visOk(visibility, LM.LEFT_SHOULDER) &&
    visOk(visibility, LM.RIGHT_SHOULDER)
  ) {
    shoulderAcross = s.v0.subVectors(rs, ls);
    shoulderAcross.y = 0;
    if (shoulderAcross.lengthSq() > 1e-10) shoulderAcross.normalize();
    else shoulderAcross = null;
  }

  let hipAcross: Vector3 | null = null;
  const lh = points[LM.LEFT_HIP];
  const rh = points[LM.RIGHT_HIP];
  if (lh && rh && visOk(visibility, LM.LEFT_HIP) && visOk(visibility, LM.RIGHT_HIP)) {
    hipAcross = s.v1.subVectors(rh, lh);
    hipAcross.y = 0;
    if (hipAcross.lengthSq() > 1e-10) hipAcross.normalize();
    else hipAcross = null;
  }

  if (!shoulderAcross && !hipAcross) return null;

  if (shoulderAcross && hipAcross) {
    s.across.copy(shoulderAcross).add(hipAcross).normalize();
  } else {
    s.across.copy(shoulderAcross ?? hipAcross!);
  }

  if (s.across.lengthSq() < 1e-8) return null;

  s.forward.crossVectors(s.up, s.across).normalize();
  if (s.forward.lengthSq() < 1e-8) return null;
  s.right.crossVectors(s.up, s.forward).normalize();
  s.m.makeBasis(s.right, s.up, s.forward);
  return s.q.setFromRotationMatrix(s.m);
}

function alignAxisInParent(
  bone: Bone | undefined,
  worldA: Vector3,
  worldB: Vector3,
  s: RetargetScratch,
  strength = 1,
): void {
  if (!bone) return;
  const r = (bone.userData as { retarget?: BoneRetargetMeta }).retarget;
  if (!r) return;

  if (r.tailBindParentDir) {
    s.across.copy(r.tailBindParentDir);
  } else if (r.restForward) {
    s.across.copy(r.restForward).applyQuaternion(r.bindQuat).normalize();
  } else {
    return;
  }

  const parent = bone.parent;
  if (!parent) return;
  parent.updateMatrixWorld(true);
  s.invParent.copy(parent.matrixWorld).invert();
  s.v0.copy(worldA).applyMatrix4(s.invParent);
  s.v1.copy(worldB).applyMatrix4(s.invParent);
  s.dir.subVectors(s.v1, s.v0);
  if (s.dir.lengthSq() < 1e-8) return;
  s.dir.normalize();

  s.qAlign.setFromUnitVectors(s.across, s.dir);
  s.q.copy(s.qAlign).multiply(r.bindQuat);
  if (strength >= 0.999) {
    bone.quaternion.copy(s.q);
  } else {
    bone.quaternion.copy(r.bindQuat).slerp(s.q, strength);
  }
}

export interface RetargetInput {
  bones: Map<string, Bone>;
  skeletonBones: Bone[];
  points: Vector3[];
  visibility: number[];
  /** World-space segment endpoints (already multiplied by offset-group matrixWorld). */
  worldPoints: Vector3[];
  scratch: RetargetScratch;
}

/**
 * Build `worldPoints[i]` = landmark i transformed into Three.js world space.
 * Caller reuses `worldPoints` array length 33.
 */
export function fillWorldLandmarks(
  points: Vector3[],
  visibility: number[],
  offsetGroupMatrixWorld: Matrix4,
  worldPoints: Vector3[],
): void {
  for (let i = 0; i < points.length; i++) {
    let wp = worldPoints[i];
    if (!wp) {
      wp = new Vector3();
      worldPoints[i] = wp;
    }
    if (!visOk(visibility, i)) {
      wp.set(0, 0, 0);
      continue;
    }
    const p = points[i];
    if (!p) {
      wp.set(0, 0, 0);
      continue;
    }
    wp.copy(p).applyMatrix4(offsetGroupMatrixWorld);
  }
}

/** Mean hip→knee→ankle chain length in `points` units (per visible leg, averaged). */
export function estimateMeanLegLength(
  points: Vector3[],
  visibility: number[],
): number | null {
  let sum = 0;
  let n = 0;
  const leg = (hip: number, knee: number, ankle: number) => {
    if (!visOk(visibility, hip) || !visOk(visibility, knee) || !visOk(visibility, ankle)) {
      return;
    }
    const a = points[hip];
    const b = points[knee];
    const c = points[ankle];
    if (!a || !b || !c) return;
    sum += a.distanceTo(b) + b.distanceTo(c);
    n++;
  };
  leg(LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE);
  leg(LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE);
  if (n === 0) return null;
  return sum / n;
}

/** Apply limb rotations to match MediaPipe stick segments (torso, limbs, feet, neck). */
export function applyLimbRetarget(input: RetargetInput): void {
  const { bones, worldPoints, scratch: s } = input;
  const w = worldPoints;
  const getB = (core: string) => resolveMixamoBone(bones, core);

  const wlh = w[LM.LEFT_HIP];
  const wrh = w[LM.RIGHT_HIP];
  const wls = w[LM.LEFT_SHOULDER];
  const wrs = w[LM.RIGHT_SHOULDER];
  const hipMidOk =
    wlh &&
    wrh &&
    visOk(input.visibility, LM.LEFT_HIP) &&
    visOk(input.visibility, LM.RIGHT_HIP);
  const shoulderOk =
    wls &&
    wrs &&
    visOk(input.visibility, LM.LEFT_SHOULDER) &&
    visOk(input.visibility, LM.RIGHT_SHOULDER);

  if (hipMidOk && shoulderOk) {
    s.hipMid.copy(wlh).add(wrh).multiplyScalar(0.5);
    s.shoulderMid.copy(wls).add(wrs).multiplyScalar(0.5);
    alignAxisInParent(getB(MIXAMO.SPINE), s.hipMid, s.shoulderMid, s, 0.22);
    alignAxisInParent(getB(MIXAMO.SPINE1), s.hipMid, s.shoulderMid, s, 0.38);
    alignAxisInParent(getB(MIXAMO.SPINE2), s.hipMid, s.shoulderMid, s, 0.52);
  }

  const nose = w[LM.NOSE];
  if (nose && visOk(input.visibility, LM.NOSE)) {
    const neck = getB(MIXAMO.NECK);
    if (neck) {
      if (shoulderOk && wls && wrs) {
        s.shoulderMid.copy(wls).add(wrs).multiplyScalar(0.5);
        alignAxisInParent(neck, s.shoulderMid, nose, s, 0.88);
      } else if (hipMidOk && wlh && wrh) {
        s.hipMid.copy(wlh).add(wrh).multiplyScalar(0.5);
        alignAxisInParent(neck, s.hipMid, nose, s, 0.75);
      }
    }
  }

  const lh = w[LM.LEFT_HIP];
  const lk = w[LM.LEFT_KNEE];
  const la = w[LM.LEFT_ANKLE];
  if (lh && lk && la) {
    if (
      visOk(input.visibility, LM.LEFT_HIP) &&
      visOk(input.visibility, LM.LEFT_KNEE)
    ) {
      alignAxisInParent(getB(MIXAMO.LEFT_UP_LEG), lh, lk, s, 1);
    }
    if (
      visOk(input.visibility, LM.LEFT_KNEE) &&
      visOk(input.visibility, LM.LEFT_ANKLE)
    ) {
      alignAxisInParent(getB(MIXAMO.LEFT_LEG), lk, la, s, 1);
    }
  }

  const wLa = w[LM.LEFT_ANKLE];
  const wLf = w[LM.LEFT_FOOT_INDEX];
  if (
    wLa &&
    wLf &&
    visOk(input.visibility, LM.LEFT_ANKLE) &&
    visOk(input.visibility, LM.LEFT_FOOT_INDEX)
  ) {
    alignAxisInParent(getB(MIXAMO.LEFT_FOOT), wLa, wLf, s, 0.75);
  }

  const rh = w[LM.RIGHT_HIP];
  const rk = w[LM.RIGHT_KNEE];
  const ra = w[LM.RIGHT_ANKLE];
  if (rh && rk && ra) {
    if (
      visOk(input.visibility, LM.RIGHT_HIP) &&
      visOk(input.visibility, LM.RIGHT_KNEE)
    ) {
      alignAxisInParent(getB(MIXAMO.RIGHT_UP_LEG), rh, rk, s, 1);
    }
    if (
      visOk(input.visibility, LM.RIGHT_KNEE) &&
      visOk(input.visibility, LM.RIGHT_ANKLE)
    ) {
      alignAxisInParent(getB(MIXAMO.RIGHT_LEG), rk, ra, s, 1);
    }
  }

  const wRa = w[LM.RIGHT_ANKLE];
  const wRf = w[LM.RIGHT_FOOT_INDEX];
  if (
    wRa &&
    wRf &&
    visOk(input.visibility, LM.RIGHT_ANKLE) &&
    visOk(input.visibility, LM.RIGHT_FOOT_INDEX)
  ) {
    alignAxisInParent(getB(MIXAMO.RIGHT_FOOT), wRa, wRf, s, 0.75);
  }

  const ls = w[LM.LEFT_SHOULDER];
  const le = w[LM.LEFT_ELBOW];
  const lw = w[LM.LEFT_WRIST];
  if (ls && le && lw) {
    if (
      visOk(input.visibility, LM.LEFT_SHOULDER) &&
      visOk(input.visibility, LM.LEFT_ELBOW)
    ) {
      alignAxisInParent(getB(MIXAMO.LEFT_ARM), ls, le, s, 1);
    }
    if (
      visOk(input.visibility, LM.LEFT_ELBOW) &&
      visOk(input.visibility, LM.LEFT_WRIST)
    ) {
      alignAxisInParent(getB(MIXAMO.LEFT_FORE_ARM), le, lw, s, 1);
    }
  }

  const rs = w[LM.RIGHT_SHOULDER];
  const re = w[LM.RIGHT_ELBOW];
  const rw = w[LM.RIGHT_WRIST];
  if (rs && re && rw) {
    if (
      visOk(input.visibility, LM.RIGHT_SHOULDER) &&
      visOk(input.visibility, LM.RIGHT_ELBOW)
    ) {
      alignAxisInParent(getB(MIXAMO.RIGHT_ARM), rs, re, s, 1);
    }
    if (
      visOk(input.visibility, LM.RIGHT_ELBOW) &&
      visOk(input.visibility, LM.RIGHT_WRIST)
    ) {
      alignAxisInParent(getB(MIXAMO.RIGHT_FORE_ARM), re, rw, s, 1);
    }
  }
}
