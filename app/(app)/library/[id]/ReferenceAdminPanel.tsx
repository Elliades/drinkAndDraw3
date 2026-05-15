import type { ReferenceListItem } from "@/services/references";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import {
  addReferenceTagFromLibraryAction,
  removeReferenceTagFromLibraryAction,
  updateReferenceDisplayTitleAction,
} from "./actions";

export function ReferenceAdminPanel({ reference }: { reference: ReferenceListItem }) {
  return (
    <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Admin</p>

      <form action={updateReferenceDisplayTitleAction} className="space-y-2">
        <input type="hidden" name="referenceId" value={reference.id} />
        <label className="block text-sm font-medium" htmlFor={`ref-title-${reference.id}`}>
          Display title
        </label>
        <p className="text-xs text-muted-foreground">Shown instead of the file name when set.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={`ref-title-${reference.id}`}
            name="title"
            defaultValue={reference.title ?? ""}
            placeholder={reference.filename}
            className="max-w-md"
          />
          <Button type="submit" size="sm" variant="outline">
            Save title
          </Button>
        </div>
      </form>

      <TagSection refId={reference.id} kind="USER" label="User tags" tags={reference.userTags} />
      <TagSection refId={reference.id} kind="ADMIN" label="Admin tags" tags={reference.adminTags} />
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
          <form key={t} action={removeReferenceTagFromLibraryAction} className="inline-flex">
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
        <form action={addReferenceTagFromLibraryAction} className="inline-flex items-center gap-1">
          <input type="hidden" name="referenceId" value={refId} />
          <input type="hidden" name="kind" value={kind} />
          <Input
            name="tagName"
            placeholder={`add ${kind.toLowerCase()} tag`}
            className="h-8 w-36 text-xs"
          />
          <Button type="submit" size="sm" variant="outline">
            +
          </Button>
        </form>
      </div>
    </div>
  );
}
