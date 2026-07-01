/**

 * SMPL -> Mixamo retarget for the anatomical rig.

 *

 * - **Default**: global quaternion transfer (parent-first), root scaled to match

 *   the same normalized `joints3d` frame as the 3D stick and HMR mesh.

 * - **Fit to SMPL**: global pose + aim each mapped bone along SMPL joint pairs

 *   (same endpoints as the stick figure — no extra root rotation).

 */



import { Bone, Object3D, Quaternion, Vector3 } from "three";

import {

  SMPL,

  SMPL_JOINT_COUNT,

  SMPL_PARENTS,

  SMPL_TO_MIXAMO,

  computeSmplRigRootScale,

  smplGlobalQuatsInThree,

  smplJoints3dToThree,

  smplStickSegmentRoll,

} from "../lib/smpl";

import {

  MIXAMO,

  alignAxisInParent,

  resolveMixamoBone,

  resetBonesToBind,

  type RetargetScratch,

} from "./mixamo-y-bot-retarget";



interface SmplBoneEntry {

  joint: number;

  parentJoint: number;

  bone: Bone;

  bindWorldQuat: Quaternion;

  bindLocalPos: Vector3;

}



export interface SmplRigBinding {

  entries: SmplBoneEntry[];

  legBindLen: number;

}



const _scratchParentWorld = new Quaternion();

const _scratchDelta = new Quaternion();

const _scratchDesired = new Quaternion();

const _rollDelta = new Quaternion();

const _boneWorldQ = new Quaternion();



/** Mixamo bone aim rules: point bone at SMPL segment [from → to]. */

const SMPL_AIM_RULES: ReadonlyArray<{

  mixamo: string;

  from: number;

  to: number;

  rollJoint?: number;

  strength?: number;

}> = [

  { mixamo: MIXAMO.SPINE, from: SMPL.PELVIS, to: SMPL.SPINE1, strength: 1 },

  { mixamo: MIXAMO.SPINE1, from: SMPL.SPINE1, to: SMPL.SPINE2, strength: 1 },

  { mixamo: MIXAMO.SPINE2, from: SMPL.SPINE2, to: SMPL.SPINE3, strength: 1 },

  { mixamo: MIXAMO.NECK, from: SMPL.SPINE3, to: SMPL.NECK, strength: 1 },

  { mixamo: MIXAMO.HEAD, from: SMPL.NECK, to: SMPL.HEAD, strength: 0.9 },

  {

    mixamo: MIXAMO.LEFT_SHOULDER,

    from: SMPL.SPINE3,

    to: SMPL.LEFT_COLLAR,

    strength: 0.9,

  },

  {

    mixamo: MIXAMO.RIGHT_SHOULDER,

    from: SMPL.SPINE3,

    to: SMPL.RIGHT_COLLAR,

    strength: 0.9,

  },

  {

    mixamo: MIXAMO.LEFT_ARM,

    from: SMPL.LEFT_SHOULDER,

    to: SMPL.LEFT_ELBOW,

    strength: 1,

  },

  {

    mixamo: MIXAMO.LEFT_FORE_ARM,

    from: SMPL.LEFT_ELBOW,

    to: SMPL.LEFT_WRIST,

    rollJoint: SMPL.LEFT_ELBOW,

    strength: 1,

  },

  {

    mixamo: "LeftHand",

    from: SMPL.LEFT_WRIST,

    to: SMPL.LEFT_HAND,

    rollJoint: SMPL.LEFT_WRIST,

    strength: 0.85,

  },

  {

    mixamo: MIXAMO.RIGHT_ARM,

    from: SMPL.RIGHT_SHOULDER,

    to: SMPL.RIGHT_ELBOW,

    strength: 1,

  },

  {

    mixamo: MIXAMO.RIGHT_FORE_ARM,

    from: SMPL.RIGHT_ELBOW,

    to: SMPL.RIGHT_WRIST,

    rollJoint: SMPL.RIGHT_ELBOW,

    strength: 1,

  },

  {

    mixamo: "RightHand",

    from: SMPL.RIGHT_WRIST,

    to: SMPL.RIGHT_HAND,

    rollJoint: SMPL.RIGHT_WRIST,

    strength: 0.85,

  },

  {

    mixamo: MIXAMO.LEFT_UP_LEG,

    from: SMPL.LEFT_HIP,

    to: SMPL.LEFT_KNEE,

    strength: 1,

  },

  {

    mixamo: MIXAMO.LEFT_LEG,

    from: SMPL.LEFT_KNEE,

    to: SMPL.LEFT_ANKLE,

    rollJoint: SMPL.LEFT_KNEE,

    strength: 1,

  },

  {

    mixamo: MIXAMO.LEFT_FOOT,

    from: SMPL.LEFT_ANKLE,

    to: SMPL.LEFT_FOOT,

    rollJoint: SMPL.LEFT_ANKLE,

    strength: 0.9,

  },

  {

    mixamo: MIXAMO.RIGHT_UP_LEG,

    from: SMPL.RIGHT_HIP,

    to: SMPL.RIGHT_KNEE,

    strength: 1,

  },

  {

    mixamo: MIXAMO.RIGHT_LEG,

    from: SMPL.RIGHT_KNEE,

    to: SMPL.RIGHT_ANKLE,

    rollJoint: SMPL.RIGHT_KNEE,

    strength: 1,

  },

  {

    mixamo: MIXAMO.RIGHT_FOOT,

    from: SMPL.RIGHT_ANKLE,

    to: SMPL.RIGHT_FOOT,

    rollJoint: SMPL.RIGHT_ANKLE,

    strength: 0.9,

  },

];



export function captureSmplBinding(bones: Map<string, Bone>): SmplRigBinding {

  const entries: SmplBoneEntry[] = [];

  for (const [joint, core] of SMPL_TO_MIXAMO) {

    const bone = resolveMixamoBone(bones, core);

    if (!bone) continue;

    bone.updateWorldMatrix(true, false);

    const bindWorldQuat = new Quaternion();

    bone.getWorldQuaternion(bindWorldQuat);

    entries.push({

      joint,

      parentJoint: SMPL_PARENTS[joint] ?? -1,

      bone,

      bindWorldQuat,

      bindLocalPos: bone.position.clone(),

    });

  }



  let legBindLen = 0;

  for (const e of entries) {

    if (e.joint === SMPL.LEFT_KNEE || e.joint === SMPL.LEFT_ANKLE) {

      legBindLen += e.bindLocalPos.length();

    }

  }

  return { entries, legBindLen };

}



function sortBindingParentFirst(entries: SmplBoneEntry[]): SmplBoneEntry[] {

  const byJoint = new Map(entries.map((e) => [e.joint, e]));

  const sorted: SmplBoneEntry[] = [];

  const visited = new Set<number>();



  function visit(j: number) {

    if (visited.has(j)) return;

    const e = byJoint.get(j);

    if (!e) return;

    if (e.parentJoint >= 0) visit(e.parentJoint);

    visited.add(j);

    sorted.push(e);

  }



  for (const e of entries) visit(e.joint);

  return sorted;

}



function jointWorld(

  pts: Vector3[],

  index: number,

  rootScale: number,

  out: Vector3,

): boolean {

  const p = pts[index];

  if (!p) return false;

  out.copy(p).multiplyScalar(rootScale);

  return true;

}



function applyRollAboutSegment(

  bone: Bone,

  dir: Vector3,

  rollJoint: number,

  smplGlobals: Quaternion[],

  rollStrength: number,

): void {

  const gq = smplGlobals[rollJoint];

  if (!gq || dir.lengthSq() < 1e-10) return;

  const roll = smplStickSegmentRoll(gq, dir) * rollStrength;

  if (Math.abs(roll) < 1e-5) return;



  const parent = bone.parent;

  if (!parent) return;

  parent.updateMatrixWorld(true);

  bone.updateMatrixWorld(true);

  parent.getWorldQuaternion(_scratchParentWorld);

  bone.getWorldQuaternion(_boneWorldQ);

  _rollDelta.setFromAxisAngle(dir, roll);

  _boneWorldQ.premultiply(_rollDelta);

  bone.quaternion.copy(_scratchParentWorld.invert().multiply(_boneWorldQ));

}



/** Global quaternion transfer (SMPL axis-angle FK -> Mixamo locals), parent-first. */

function applySmplGlobalPose(binding: SmplRigBinding, pose: ArrayLike<number>): void {

  const globals = smplGlobalQuatsInThree(pose);



  for (const e of sortBindingParentFirst(binding.entries)) {

    const g = globals[e.joint];

    if (!g) continue;

    const bone = e.bone;

    bone.position.copy(e.bindLocalPos);



    _scratchDelta.copy(g);

    _scratchDesired.copy(_scratchDelta).multiply(e.bindWorldQuat);



    const parent = bone.parent;

    if (parent) {

      parent.updateMatrixWorld(true);

      parent.getWorldQuaternion(_scratchParentWorld);

      bone.quaternion.copy(_scratchParentWorld.invert()).multiply(_scratchDesired);

    } else {

      bone.quaternion.copy(_scratchDesired);

    }

    bone.updateMatrixWorld(false);

  }

}



/**

 * After global pose, nudge mapped bones toward SMPL joint segments (same graph as

 * the 3D stick). Uses joint positions, not bone-head guesses.

 */

function applySmplJointAim(

  bones: Map<string, Bone>,

  pts: Vector3[],

  pose: ArrayLike<number>,

  rootScale: number,

  scratch: RetargetScratch,

  blendStrength: number,

): void {

  const smplGlobals = smplGlobalQuatsInThree(pose);



  for (const rule of SMPL_AIM_RULES) {

    const bone = resolveMixamoBone(bones, rule.mixamo);

    if (!bone) continue;



    if (

      !jointWorld(pts, rule.from, rootScale, scratch.v0) ||

      !jointWorld(pts, rule.to, rootScale, scratch.v1)

    ) {

      continue;

    }



    const strength = (rule.strength ?? 1) * blendStrength;

    alignAxisInParent(bone, scratch.v0, scratch.v1, scratch, strength);



    if (rule.rollJoint != null) {

      scratch.dir.subVectors(scratch.v1, scratch.v0);

      if (scratch.dir.lengthSq() > 1e-10) {

        scratch.dir.normalize();

        applyRollAboutSegment(bone, scratch.dir, rule.rollJoint, smplGlobals, 0.85);

      }

    }

  }

}



function applySmplSpatialFit(

  binding: SmplRigBinding,

  bones: Map<string, Bone>,

  pose: ArrayLike<number>,

  joints3d: number[][],

  root: Object3D,

  scratch: RetargetScratch,

  modelBindHeight: number,

): void {

  const pts = smplJoints3dToThree(joints3d);

  const rootScale = computeSmplRigRootScale(pts, modelBindHeight);



  for (const e of binding.entries) {

    e.bone.position.copy(e.bindLocalPos);

  }



  root.position.set(0, 0, 0);

  root.quaternion.identity();

  root.scale.setScalar(rootScale);

  root.updateMatrixWorld(true);



  applySmplGlobalPose(binding, pose);

  root.updateMatrixWorld(true);



  applySmplJointAim(bones, pts, pose, rootScale, scratch, 0.72);

}



export interface ApplySmplInput {

  binding: SmplRigBinding;

  bones: Map<string, Bone>;

  skeletonBones: Bone[];

  pose: ArrayLike<number>;

  joints3d: number[][] | null;

  scratch: RetargetScratch;

  modelBindLegLen: number;

  modelBindHeight: number;

  root: Object3D;

  spatialFit?: boolean;

}



export function applySmplPose(input: ApplySmplInput): void {

  const {

    binding,

    bones,

    skeletonBones,

    pose,

    joints3d,

    scratch,

    modelBindHeight,

    root,

    spatialFit,

  } = input;



  resetBonesToBind(skeletonBones);



  const hasJoints =

    joints3d != null && joints3d.length >= SMPL_JOINT_COUNT;



  if (spatialFit === true && hasJoints) {

    applySmplSpatialFit(

      binding,

      bones,

      pose,

      joints3d,

      root,

      scratch,

      modelBindHeight,

    );

    return;

  }



  let rootScale = 1;

  if (hasJoints) {

    const pts = smplJoints3dToThree(joints3d);

    rootScale = computeSmplRigRootScale(pts, modelBindHeight);

  }



  root.position.set(0, 0, 0);

  root.quaternion.identity();

  root.scale.setScalar(rootScale);



  applySmplGlobalPose(binding, pose);

}


