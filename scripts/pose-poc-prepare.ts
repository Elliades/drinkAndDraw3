/**
 * Prepare the /pose-poc validation page: copy test images into public/,
 * run NLF export for SMPL JSON sidecars, write the browser manifest.
 *
 * Does not touch the database or storage — only public/pose-poc/.
 *
 * Usage:
 *   npm run pose-poc:prepare
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

/** Stable ids used in URLs and JSON filenames. */
const CASES = [
  {
    id: "dsc00407",
    label: "Female 29 dynamic — DSC00407",
    source:
      "F:\\ModelVivant\\Daily Sketching Female 29 - dynamic\\Best picture\\DSC00407.jpg",
  },
  {
    id: "kurilko6384",
    label: "Female 25 dynamic — kurilko6384",
    source:
      "F:\\ModelVivant\\Daily Sketching Female 25\\dynamic\\kurilko6384.jpg",
  },
  {
    id: "dsc07758",
    label: "Female 25 poses — DSC07758",
    source: "F:\\ModelVivant\\Daily Sketching Female 25\\poses\\DSC07758.jpg",
  },
] as const;

const PUBLIC_DIR = path.join(ROOT, "public", "pose-poc");
const IMAGES_DIR = path.join(PUBLIC_DIR, "images");
const DATA_DIR = path.join(PUBLIC_DIR, "data");
const MESHES_DIR = path.join(PUBLIC_DIR, "meshes");
const TOOLS_DIR = path.join(ROOT, "tools", "pose3d");
const POC_IN = path.join(TOOLS_DIR, "poc-in.json");
const POC_OUT = path.join(TOOLS_DIR, "poc-out");

async function fileExists(p: string): Promise<boolean> {
  try {
    const st = await fs.stat(p);
    return st.isFile();
  } catch {
    return false;
  }
}

async function main() {
  await fs.mkdir(IMAGES_DIR, { recursive: true });
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(MESHES_DIR, { recursive: true });

  const exportManifest: Array<{ id: string; image: string }> = [];
  const browserManifest: Array<{
    id: string;
    label: string;
    imageUrl: string;
    poseDataUrl: string;
    poseMeshUrl?: string;
  }> = [];

  for (const c of CASES) {
    if (!(await fileExists(c.source))) {
      console.error(`Missing source image: ${c.source}`);
      process.exit(1);
    }
    const ext = path.extname(c.source).toLowerCase() || ".jpg";
    const destImage = path.join(IMAGES_DIR, `${c.id}${ext}`);
    await fs.copyFile(c.source, destImage);
    console.log(`Copied → public/pose-poc/images/${c.id}${ext}`);

    exportManifest.push({ id: c.id, image: c.source });
    browserManifest.push({
      id: c.id,
      label: c.label,
      imageUrl: `/pose-poc/images/${c.id}${ext}`,
      poseDataUrl: `/pose-poc/data/${c.id}.json`,
    });
  }

  await fs.writeFile(POC_IN, JSON.stringify(exportManifest, null, 2), "utf-8");
  console.log(`Wrote ${POC_IN}`);

  const venvPython = path.join(TOOLS_DIR, ".venv", "Scripts", "python.exe");
  const python = (await fileExists(venvPython)) ? venvPython : "python";
  const exportScript = path.join(TOOLS_DIR, "export_glb.py");

  console.log(`Running NLF export (${python}) …`);
  const result = spawnSync(
    python,
    [
      exportScript,
      "--backend",
      "nlf",
      "--manifest",
      POC_IN,
      "--out-dir",
      POC_OUT,
      "--mesh",
      "--force",
    ],
    { cwd: TOOLS_DIR, stdio: "inherit", shell: false },
  );

  if (result.status !== 0) {
    console.error("NLF export failed. Is the venv set up? See tools/pose3d/README.md");
    process.exit(result.status ?? 1);
  }

  for (const c of CASES) {
    const srcJson = path.join(POC_OUT, `${c.id}.json`);
    if (!(await fileExists(srcJson))) {
      console.error(`Expected ${srcJson} after export`);
      process.exit(1);
    }
    const destJson = path.join(DATA_DIR, `${c.id}.json`);
    await fs.copyFile(srcJson, destJson);
    console.log(`Pose data → public/pose-poc/data/${c.id}.json`);

    const srcGlb = path.join(POC_OUT, `${c.id}.glb`);
    if (await fileExists(srcGlb)) {
      const destGlb = path.join(MESHES_DIR, `${c.id}.glb`);
      await fs.copyFile(srcGlb, destGlb);
      const entry = browserManifest.find((m) => m.id === c.id);
      if (entry) {
        entry.poseMeshUrl = `/pose-poc/meshes/${c.id}.glb`;
      }
      console.log(`Pose mesh → public/pose-poc/meshes/${c.id}.glb`);
    }
  }

  await fs.writeFile(
    path.join(PUBLIC_DIR, "manifest.json"),
    JSON.stringify(browserManifest, null, 2),
    "utf-8",
  );

  console.log("\nDone. Open http://localhost:3000/pose-poc (or npm run pose-poc:dev)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
