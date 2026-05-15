import { requireUser } from "@/auth/guards";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { uploadDrawingAction } from "./actions";

interface PageProps {
  searchParams: Promise<{ referenceId?: string }>;
}

export const dynamic = "force-dynamic";

export default async function UploadDrawingPage({ searchParams }: PageProps) {
  await requireUser();
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload drawing</h1>
        <p className="text-sm text-muted-foreground">PNG, JPEG, or WebP. Max 10MB.</p>
      </div>
      <form action={uploadDrawingAction} className="space-y-3">
        {params.referenceId ? (
          <input type="hidden" name="referenceId" value={params.referenceId} />
        ) : null}
        <label className="block space-y-1">
          <span className="text-sm font-medium">Title (optional)</span>
          <Input name="title" placeholder="Hand study" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">File</span>
          <Input
            name="file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
          />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isPublic" defaultChecked />
          <span className="text-sm">Make public</span>
        </label>
        <Button type="submit" className="w-full">
          Upload
        </Button>
      </form>
    </div>
  );
}
