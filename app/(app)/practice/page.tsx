import { listTags } from "@/services/tags";
import { PracticeConfigForm } from "./PracticeConfigForm";

export const dynamic = "force-dynamic";

export default async function PracticePage() {
  const tags = await listTags({ limit: 50 });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New practice session</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your timed session and start drawing.
        </p>
      </div>
      <PracticeConfigForm tags={tags.map((t) => t.name)} />
    </div>
  );
}
