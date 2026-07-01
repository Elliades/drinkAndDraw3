import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pose POC",
  description: "Quick SMPL stick + anatomy validation (no database).",
};

/** Minimal chrome — no app shell, auth, or DB. */
export default function PosePocLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
