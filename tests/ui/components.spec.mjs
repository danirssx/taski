import { test, expect } from "@playwright/test";

const errorsByPage = new WeakMap();
test.beforeEach(async ({ page }) => {
  const errors = [];
  errorsByPage.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  expect(errors).toEqual([]);
});
test.afterEach(async ({ page }) => expect(errorsByPage.get(page)).toEqual([]));

test("desktop detail preserves an interactive list and restores keyboard focus", async ({ page }) => {
  const opener = page.getByRole("button", { name: "Abrir Dar espacio a lo importante" });
  await opener.click();
  const panel = page.getByRole("region", { name: "Dar espacio a lo importante" });
  await expect(panel).toBeVisible();
  await expect(panel).not.toHaveAttribute("aria-modal");
  await page.getByRole("button", { name: "Abrir Revisar los últimos detalles" }).click();
  await expect(page.getByRole("region", { name: "Revisar los últimos detalles" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".detail-panel")).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("highlight is a controlled presentation event independent of opening detail", async ({ page }) => {
  const control = page.getByRole("button", { name: "Resaltar Dar espacio a lo importante", exact: true });
  await expect(control).toHaveAttribute("aria-pressed", "true");
  await control.click();
  await expect(control).toHaveAttribute("aria-pressed", "false");
  await control.click();
  await page.getByRole("button", { name: "Abrir Dar espacio a lo importante" }).click();
  await expect(page.getByRole("region").getByRole("button", { name: "Quitar resaltado" })).toHaveAttribute("aria-pressed", "true");
});

test("inline input associates errors and opens the created example without submitting elsewhere", async ({ page }) => {
  await page.getByRole("button", { name: "Añadir tarea", exact: true }).click();
  const input = page.getByLabel("Nueva tarea de ejemplo");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Escribe un título para continuar.", { exact: true })).toBeVisible();
  await input.fill("Una tarea de ejemplo");
  await input.press("Enter");
  await expect(page.getByRole("region", { name: "Una tarea de ejemplo" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(input).toBeFocused();
  await page.reload();
  await expect(page.getByRole("button", { name: "Abrir Una tarea de ejemplo" })).toHaveCount(0);
});

test("theme follows the system and remembers an explicit preference", async ({ page }) => {
  await page.getByLabel("Tema", { exact: true }).selectOption("system");
  await page.emulateMedia({ colorScheme: "light" });
  const light = await page.locator("html").evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.emulateMedia({ colorScheme: "dark" });
  const dark = await page.locator("html").evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(light).not.toBe(dark);
  await page.getByLabel("Tema", { exact: true }).selectOption("light");
  await page.reload();
  await expect(page.getByLabel("Tema", { exact: true })).toHaveValue("light");
  expect(await page.locator("html").evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(light);
});

test("mobile feedback uses full-screen detail and contains keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("button", { name: "Feedback", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Abrir Una forma más simple de compartir ideas" }).click();
  const panel = page.getByRole("dialog", { name: "Una forma más simple de compartir ideas" });
  await expect(panel).toHaveAttribute("aria-modal", "true");
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  const box = await panel.boundingBox();
  expect(box.x).toBe(0);
  expect(box.width).toBe(390);
  for (let n = 0; n < 9; n++) {
    await page.keyboard.press("Tab");
    expect(await panel.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("another preset changes presentation without replacing the component library", async ({ page }) => {
  await page.getByLabel("Proyecto de ejemplo").selectOption("studio");
  await expect(page.locator(".wordmark")).toHaveText("Taski Studio");
  await expect(page.locator(".task-row__code").first()).toHaveText("EDIT-001");
  await page.getByLabel("Buscar en los ejemplos").fill("no coincide");
  await expect(page.getByRole("status").getByText("Nada por aquí")).toBeVisible();
  await expect(page.locator(".task-row")).toHaveCount(0);
});
