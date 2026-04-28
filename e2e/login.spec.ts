import { test, expect } from "@playwright/test";

test.describe("Login Page", () => {
  test("should load the login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/Lendy/i);
    await expect(page.locator("h2", { hasText: "Welcome back" })).toBeVisible();
  });

  test("should display login form fields", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator('input#login')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("should redirect root to login", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/login");
    await expect(page.locator("h2", { hasText: "Welcome back" })).toBeVisible();
  });

  test("should show validation when submitting empty form", async ({ page }) => {
    await page.goto("/login");

    // Clear any default values and submit
    await page.locator('input#login').fill("");
    await page.locator('input#password').fill("");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Browser-native required validation should prevent submission
    // or custom validation errors should appear
    const loginInput = page.locator('input#login');
    await expect(loginInput).toHaveAttribute("required", "");
  });

  test("should toggle password visibility", async ({ page }) => {
    await page.goto("/login");

    const passwordInput = page.locator('input#password');
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Click the toggle button (eye icon)
    await page.locator('input#password + button').click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    // Click again to hide
    await page.locator('input#password + button').click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("should have remember me checkbox", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/remember me/i)).toBeVisible();
  });

  test("should have forgot password link", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: /forgot password/i })).toBeVisible();
  });
});
