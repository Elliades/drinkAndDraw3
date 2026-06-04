import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { addTagAction, removeTagAction } from "./actions";

export interface AdminReferenceRow {
  id: string;
  filename: string;
  title: string | null;
  folderPath: string;
  url: string;
  thumbnailUrl: string;
  userTags: string[];
  adminTags: string[];
}

export function ReferenceRow({ ref }: { ref: AdminReferenceRow }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border py-3 last:border-b-0 md:flex-row md:items-start">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ref.thumbnailUrl}
        alt={ref.title ?? ref.filename}
        className="h-24 w-24 flex-none rounded border border-border object-cover"
      />
      <div className="flex-1 space-y-2">
        <div>
          <p className="font-medium">{ref.title ?? ref.filename}</p>
          <p className="text-xs text-muted-foreground">{ref.folderPath || "(root)"}</p>
        </div>
        <TagSection refId={ref.id} kind="USER" label="User tags" tags={ref.userTags} />
        <TagSection refId={ref.id} kind="ADMIN" label="Admin tags" tags={ref.adminTags} />
      </div>
    </div>
  );
}

function TagSection({
  refId,
  kind,
  label,
  tags,
}: {
  refId: string;
  kind: "USER" | "ADMIN";
  label: string;
  tags: string[];
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <form key={t} action={removeTagAction} className="inline-flex">
            <input type="hidden" name="referenceId" value={refId} />
            <input type="hidden" name="tagName" value={t} />
            <input type="hidden" name="kind" value={kind} />
            <button type="submit" className="group">
              <Badge className="cursor-pointer group-hover:bg-destructive group-hover:text-destructive-foreground">
                {t} ×
              </Badge>
            </button>
          </form>
        ))}
        <form action={addTagAction} className="inline-flex items-center gap-1">
          <input type="hidden" name="referenceId" value={refId} />
          <input type="hidden" name="kind" value={kind} />
          <Input
            name="tagName"
            placeholder={`add ${kind.toLowerCase()} tag`}
            className="h-7 w-32 text-xs"
          />
          <Button type="submit" size="sm" variant="outline">
            +
          </Button>
        </form>
      </div>
    </div>
  );
}
