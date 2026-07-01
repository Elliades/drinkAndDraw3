import { PosePocClient } from "./PosePocClient";

/**
 * Standalone proof-of-concept for SMPL-driven stick + 3D anatomy.
 * No library DB, login, or reference ingest — assets live under public/pose-poc/.
 *
 * Prepare data once (GPU machine):
 *   npm run pose-poc:prepare
 *
 * Then open:
 *   npm run pose-poc:dev
 *   → http://localhost:3001/pose-poc
 */
export default function PosePocPage() {
  return <PosePocClient />;
}
