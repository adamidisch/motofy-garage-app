import { expect, test } from "@playwright/test";

test("demo user can navigate the core Motofy workspace", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const demo = page.getByRole("button", { name: /Δοκίμασε το demo/ });
  await expect(demo).toBeVisible();
  await expect(demo).toBeEnabled();
  await demo.click();

  await expect(page.getByRole("button", { name: "Motofy home" })).toBeVisible();

  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(navigation).toBeVisible();

  await page.getByRole("button", { name: "Γλώσσα" }).click();

  await navigation.getByRole("button", { name: "Cars" }).click();
  await expect(page.getByPlaceholder("Search plate or vehicle")).toBeVisible();

  await navigation.getByRole("button", { name: "Jobs" }).click();
  await expect(navigation.getByRole("button", { name: "Jobs" })).toHaveClass(/selected/);

  await navigation.getByRole("button", { name: "Customers" }).click();
  await expect(page.getByPlaceholder("Search customer")).toBeVisible();

  await navigation.getByRole("button", { name: "Home" }).click();
  await expect(navigation.getByRole("button", { name: "Home" })).toHaveClass(/selected/);
});
