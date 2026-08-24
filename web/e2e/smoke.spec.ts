import { expect, test } from "@playwright/test";

test("landing page explains the product and reaches the task browser", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Turn uncertain bug reports/ })).toBeVisible();
  await page.getByRole("link", { name: "Explore reproduction tasks" }).click();
  await expect(page.getByRole("heading", { name: "Reproduction tasks" })).toBeVisible();
});

test("wallet page exposes recoverable disconnected state", async ({ page }) => {
  await page.goto("/app/wallet");
  await expect(page.getByText("Disconnected")).toBeVisible();
  await expect(page.getByRole("button", { name: "Review and send" })).toBeDisabled();
});

