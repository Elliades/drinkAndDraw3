import { test, expect } from "@playwright/test";

test.describe("auth gating", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  test("admin redirects when not signed in", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login|\//);
  });

  test("drawings redirects when not signed in", async ({ page }) => {
    await page.goto("/drawings");
    await expect(page).toHaveURL(/\/login|\//);
  });
});
