import { expect, test } from '@playwright/test';

const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

const loginRoutes = ['/student/login', '/teacher/login', '/admin/login'];

for (const viewport of viewports) {
  for (const route of loginRoutes) {
    test(`${route} has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(route);

      const loginCard = page.getByTestId('login-card');
      await expect(loginCard).toBeVisible();
      await expect(page.getByLabel(/email|student id|teacher id|admin id/i)).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        innerWidth: window.innerWidth,
      }));

      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 2);
      expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 2);

      const animatedAuthElements = await page
        .locator('.auth-login-page *')
        .evaluateAll((elements) =>
          elements.filter((element) => {
            const style = window.getComputedStyle(element);
            return style.animationName !== 'none' || Number.parseFloat(style.animationDuration) > 0;
          }).length,
        );

      expect(animatedAuthElements).toBe(0);
    });
  }
}
