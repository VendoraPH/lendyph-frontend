import { test, expect } from "@playwright/test";
import path from "path";
import { PNG } from "pngjs";
import fs from "fs";
import pixelmatch from "pixelmatch";

test("dashboard should match reference screenshot", async ({ page }) => {
  // Match reference image viewport size
  await page.setViewportSize({ width: 1024, height: 768 });

  // Login first
  await page.goto("/login");
  await page.locator("input#login").fill("augustin");
  await page.locator("input#password").fill("password123");
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for navigation after login
  await page.waitForURL("**/dashboard", { timeout: 10000 });

  // Wait for charts and content to render
  await page.waitForTimeout(5000);

  // Take current screenshot (viewport only, not full page)
  const currentScreenshotBuffer = await page.screenshot({ fullPage: false });
  fs.writeFileSync("e2e/dashboard-current.png", currentScreenshotBuffer);

  // Load reference screenshot
  const referencePath = path.resolve("e2e/dashboard.png");
  const referenceBuffer = fs.readFileSync(referencePath);
  const referenceImg = PNG.sync.read(referenceBuffer);
  const currentImg = PNG.sync.read(currentScreenshotBuffer);

  const { width, height } = referenceImg;

  console.log(`Reference: ${width}x${height}`);
  console.log(`Current: ${currentImg.width}x${currentImg.height}`);

  // If sizes still don't match, fail with clear message
  if (currentImg.width !== width || currentImg.height !== height) {
    console.log("Image sizes differ — saving both for manual review");
    expect(
      `${currentImg.width}x${currentImg.height}`
    ).toBe(`${width}x${height}`);
    return;
  }

  const diff = new PNG({ width, height });

  const mismatchedPixels = pixelmatch(
    referenceImg.data,
    currentImg.data,
    diff.data,
    width,
    height,
    { threshold: 0.3 }
  );

  // Save diff image for debugging
  fs.writeFileSync("e2e/dashboard-diff.png", PNG.sync.write(diff));

  const totalPixels = width * height;
  const mismatchPercentage = (mismatchedPixels / totalPixels) * 100;

  console.log(
    `Mismatch: ${mismatchedPixels} pixels (${mismatchPercentage.toFixed(2)}%)`
  );

  // Allow up to 5% difference to account for dynamic content
  expect(mismatchPercentage).toBeLessThan(5);
});
