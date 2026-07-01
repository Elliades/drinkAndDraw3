import { PoseSearchClient } from "./PoseSearchClient";

export const metadata = {
  title: "Pose search — drinkAndDraw",
  description: "Find reference poses by stick figure, photo, or description",
};

export default function PoseSearchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pose search</h1>
        <p className="text-sm text-muted-foreground">
          Find reference images by posing a stick figure, uploading a photo or drawing, or
          describing the pose in words. Lock limbs to search one body part at a time.
        </p>
      </div>
      <PoseSearchClient />
    </div>
  );
}
