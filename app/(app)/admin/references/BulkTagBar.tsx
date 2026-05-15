import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { bulkTagFolderAction } from "./actions";

export function BulkTagBar({ folder }: { folder: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4">
      <h2 className="mb-2 text-sm font-semibold">
        Bulk tag {folder ? <code className="rounded bg-muted px-1">{folder}</code> : "everything"}
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Comma-separated tag names. Applies to all references in this folder and its subfolders.
      </p>
      <form action={bulkTagFolderAction} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_140px_120px_120px]">
        <input type="hidden" name="folder" value={folder} />
        <Input name="tags" placeholder="hand, gesture, anatomy" required />
        <select
          name="kind"
          defaultValue="USER"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="USER">user tags</option>
          <option value="ADMIN">admin tags</option>
        </select>
        <select
          name="action"
          defaultValue="add"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="add">add</option>
          <option value="remove">remove</option>
        </select>
        <Button type="submit">Apply</Button>
      </form>
    </div>
  );
}
