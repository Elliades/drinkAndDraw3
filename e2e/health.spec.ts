import { test, expect } from "@playwright/test";

test("landing page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "drinkAndDraw" })).toBeVisible();
  await expect(page.getByRole("link", { name: /start practice/i })).toBeVisible();
});
