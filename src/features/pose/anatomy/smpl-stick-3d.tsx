"use client";

import { useMemo } from "react";
import { Quaternion, Vector3 } from "three";
import { SIDE_COLOR } from "../lib/topology";
import { SMPL_CONNECTIONS, smplConnectionSide } from "../lib/smpl";

export interface SmplStick3DProps {
  /** 24 SMPL joints in Three.js frame, centered on the pelvis. */
  joints: Vector3[];
  /**
   * Global SMPL joint orientations in Three.js frame (one per joint). Used to
   * roll each bone ribbon so axial twist is visible.
   */
  globalQuats: Quaternion[];
  /** Scales bone thickness; ~1 for a 1.75-unit-tall figure. */
  radiusScale?: number;
}

const _dir = new Vector3();
const _refX = new Vector3();
const _jointX = new Vector3();
const _proj = new Vector3();
const _cross = new Vector3();
const _qDir = new Quaternion();
const _qRoll = new Quaternion();
const UP_Y = new Vector3(0, 1, 0);
const AXIS_X = new Vector3(1, 0, 0);

interface BoneVisual {
  key: string;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  length: number;
  color: string;
}

/**
 * Compute a ribbon transform for the segment a->b: long axis aligned to the
 * measured bone direction, then rolled about that axis to match the proximal
 * joint's orientation so axial twist is visible (a plain cylinder can't show
 * roll). Returns null for degenerate segments.
 */
function buildBone(
  a: number,
  b: number,
  joints: Vector3[],
  globalQuats: Quaternion[],
): BoneVisual | null {
  const pa = joints[a];
  const pb = joints[b];
  if (!pa || !pb) return null;

  _dir.subVectors(pb, pa);
  const length = _dir.length();
  if (length < 1e-5) return null;
  _dir.multiplyScalar(1 / length);

  _qDir.setFromUnitVectors(UP_Y, _dir);

  // Box width axis (local +X) after aligning the long axis to the bone.
  _refX.copy(AXIS_X).applyQuaternion(_qDir);

  // Proximal joint's anatomical X axis, projected perpendicular to the bone.
  const gq = globalQuats[a];
  let roll = 0;
  if (gq) {
    _jointX.copy(AXIS_X).applyQuaternion(gq);
    const dot = _jointX.dot(_dir);
    _proj.copy(_jointX).addScaledVector(_dir, -dot);
    if (_proj.lengthSq() > 1e-8) {
      _proj.normalize();
      _cross.crossVectors(_refX, _proj);
      const sin = _dir.dot(_cross);
      const cos = _refX.dot(_proj);
      roll = Math.atan2(sin, cos);
    }
  }
  _qRoll.setFromAxisAngle(_dir, roll);
  const q = _qRoll.clone().multiply(_qDir);

  const mid = new Vector3().addVectors(pa, pb).multiplyScalar(0.5);

  return {
    key: `${a}-${b}`,
    position: [mid.x, mid.y, mid.z],
    quaternion: [q.x, q.y, q.z, q.w],
    length,
    color: SIDE_COLOR[smplConnectionSide(a, b)],
  };
}

/**
 * Oriented-bone (ribbon) 3D stick figure driven by SMPL joints + global
 * rotations. The flat ribbon cross-section makes axial twist legible, and the
 * spine chain / collars give more articulated points than the MediaPipe stick.
 */
export function SmplStick3D({
  joints,
  globalQuats,
  radiusScale = 1,
}: SmplStick3DProps) {
  const bones = useMemo(() => {
    const out: BoneVisual[] = [];
    for (const [a, b] of SMPL_CONNECTIONS) {
      const bone = buildBone(a, b, joints, globalQuats);
      if (bone) out.push(bone);
    }
    return out;
  }, [joints, globalQuats]);

  const width = 0.05 * radiusScale;
  const depth = 0.02 * radiusScale;
  const jointRadius = 0.02 * radiusScale;

  return (
    <group>
      {bones.map((b) => (
        <mesh key={b.key} position={b.position} quaternion={b.quaternion}>
          <boxGeometry args={[width, b.length, depth]} />
          <meshStandardMaterial color={b.color} roughness={0.45} metalness={0.1} />
        </mesh>
      ))}
      {joints.map((p, i) => (
        <mesh key={`j-${i}`} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[jointRadius, 14, 14]} />
          <meshStandardMaterial color="#e5e7eb" roughness={0.3} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

export default SmplStick3D;
