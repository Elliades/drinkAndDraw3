import { test, expect } from "@playwright/test";

test.describe("library and search", () => {
  test("library page loads", async ({ page }) => {
    await page.goto("/library");
    await expect(page.getByRole("heading", { name: /reference library/i })).toBeVisible();
  });

  test("home shows search input", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByPlaceholder(/search references/i)).toBeVisible();
  });

  test("search page renders results section", async ({ page }) => {
    await page.goto("/search?q=hand");
    await expect(page.getByRole("heading", { name: /search/i })).toBeVisible();
  });

  test("practice config page is reachable", async ({ page }) => {
    await page.goto("/practice");
    await expect(page.getByRole("heading", { name: /new practice session/i })).toBeVisible();
  });
});
