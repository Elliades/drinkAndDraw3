import Link from "next/link";
import { requireAdmin } from "@/auth/guards";
import { prisma } from "@/db/client";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  await requireAdmin();

  const [refCount, drawingCount, tagCount, userCount] = await Promise.all([
    prisma.reference.count(),
    prisma.drawing.count(),
    prisma.tag.count(),
    prisma.user.count(),
  ]);

  const stats = [
    { label: "References", value: refCount, href: "/admin/references" as const },
    { label: "Drawings", value: drawingCount },
    { label: "Tags", value: tagCount, href: "/admin/tags/review" as const },
    { label: "Users", value: userCount },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => {
          const inner = (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            </div>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="block hover:opacity-90">
              {inner}
            </Link>
          ) : (
            <div key={s.label}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
