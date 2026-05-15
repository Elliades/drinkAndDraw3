import { notFound } from "next/navigation";
import { prisma } from "@/db/client";

interface PageProps {
  params: Promise<{ handle: string }>;
}

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: PageProps) {
  const { handle } = await params;

  const user = await prisma.user.findUnique({
    where: { handle },
    select: {
      id: true,
      name: true,
      handle: true,
      image: true,
      createdAt: true,
      _count: { select: { uploadedDrawings: true, favorites: true, comments: true } },
    },
  });

  if (!user) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={user.name ?? user.handle ?? ""}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-muted" />
        )}
        <div>
          <h1 className="text-2xl font-bold">{user.name ?? user.handle}</h1>
          <p className="text-sm text-muted-foreground">@{user.handle}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="rounded-lg border border-border p-4">
          <div className="text-2xl font-bold">{user._count.uploadedDrawings}</div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Drawings</div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="text-2xl font-bold">{user._count.favorites}</div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Favorites</div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="text-2xl font-bold">{user._count.comments}</div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Comments</div>
        </div>
      </div>
    </div>
  );
}
