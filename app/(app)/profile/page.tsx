import { redirect } from "next/navigation";
import { requireUser } from "@/auth/guards";
import { updateHandleAction, signOutAction } from "./actions";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

export const dynamic = "force-dynamic";

export default async function ProfileEditPage() {
  const user = await requireUser();

  if (user.handle) {
    redirect(`/u/${user.handle}`);
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Finish your profile</h1>
        <p className="text-sm text-muted-foreground">Choose a public handle.</p>
      </div>
      <form action={updateHandleAction} className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium">Handle</span>
          <Input name="handle" required minLength={3} maxLength={32} pattern="^[a-z0-9_-]+$" placeholder="my-handle" />
          <span className="mt-1 block text-xs text-muted-foreground">
            3-32 chars, lowercase letters, digits, dashes, underscores.
          </span>
        </label>
        <Button type="submit" className="w-full">
          Save
        </Button>
      </form>
      <form action={signOutAction}>
        <Button type="submit" variant="outline" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
