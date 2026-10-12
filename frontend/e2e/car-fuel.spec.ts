import { test, expect, type Page } from '@playwright/test';

// AntD Select renders options in a dropdown portal; pick one by its visible text.
// Opens through the selector box: the search input underneath is not clickable itself.
async function selectAntdOption(page: Page, label: RegExp, optionText: string) {
  await page.locator('.ant-form-item', { has: page.getByLabel(label) }).locator('.ant-select-selector').click();
  await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option', { hasText: optionText }).click();
}

test('full car fuel management flow', async ({ page }) => {
  // 1. Open /, redirected to /login
  await page.goto('/');
  await expect(page).toHaveURL(/.*\/login/);

  // 2. Register a unique email
  const email = `e2e-${Date.now()}@example.com`;
  await page.getByRole('link', { name: /register/i }).click();
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill('Password123!');
  await page.getByRole('button', { name: /register/i }).click();
  
  // Lands on /cars, empty state shown
  await expect(page).toHaveURL(/.*\/cars/);
  await expect(page.getByText(/you have no cars/i)).toBeVisible();

  // 3. Add car: name Test Car, fuel Petrol, initial odometer 1000
  await page.getByRole('link', { name: /add car/i }).click();
  await page.getByLabel(/name/i).fill('Test Car');
  await selectAntdOption(page, /fuel type/i, 'Petrol');
  await page.getByLabel(/initial odometer/i).fill('1000');
  await page.getByRole('button', { name: /save car/i }).click();

  // listed
  await expect(page).toHaveURL(/.*\/cars/);
  await expect(page.getByText('Test Car')).toBeVisible();

  // 4. Open its refuelings. Add R1 and R2.
  await page.locator('.car-item', { hasText: 'Test Car' }).getByRole('link', { name: /refuelings/i }).click();
  
  // R1: 2026-01-01, 1000 km, 40 L, 60.00, full
  await page.getByRole('link', { name: /add refueling/i }).click();
  await page.getByLabel(/date/i).fill('2026-01-01');
  await page.getByLabel(/date/i).press('Tab'); // DatePicker commits the typed date on blur
  await page.getByLabel(/odometer/i).fill('1000');
  await page.getByLabel(/liters/i).fill('40');
  await page.getByLabel(/total cost/i).fill('60.00');
  await page.getByRole('button', { name: /save refueling/i }).click();
  
  // R2: 2026-01-15, 1500 km, 30 L, 48.00, full
  await page.getByRole('link', { name: /add refueling/i }).click();
  await page.getByLabel(/date/i).fill('2026-01-15');
  await page.getByLabel(/date/i).press('Tab');
  await page.getByLabel(/odometer/i).fill('1500');
  await page.getByLabel(/liters/i).fill('30');
  await page.getByLabel(/total cost/i).fill('48.00');
  await page.getByRole('button', { name: /save refueling/i }).click();

  // 5. Open Report, car = All cars, no date range.
  await page.getByRole('link', { name: /report/i }).click();
  
  // Expect:
  // Total spend 108.00; total liters 70.00; refuelings 2; avg price/L 1.54
  // Distance 500 km; avg consumption 6.0 L/100 km; cost/km 0.216
  // Monthly row 2026-01 | 70.00 | 108.00 | 2
  const tileValue = (title: string) =>
    page.locator('.summary-tile', { hasText: title }).locator('.ant-statistic-content-value');
  await expect(tileValue('Total Cost')).toHaveText('108.00');
  await expect(tileValue('Total Liters')).toHaveText('70.00');
  await expect(tileValue('Refuelings')).toHaveText('2');
  await expect(tileValue('Avg Price/L')).toHaveText('1.54');
  await expect(tileValue('Distance')).toHaveText('500 km');
  await expect(tileValue('Consumption')).toHaveText('6.0 L/100km');
  await expect(tileValue('Cost/km')).toHaveText('0.216');
  
  const row = page.locator('.monthly-table tbody tr');
  await expect(row).toContainText('2026-01');
  await expect(row).toContainText('70.00');
  await expect(row).toContainText('108.00');
  await expect(row).toContainText('2');

  async function expectNoHorizontalScroll(label: string) {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth, `${label}: scrollWidth vs innerWidth`).toBeLessThanOrEqual(innerWidth);
  }

  // Report loaded at phone width: no page-level horizontal scroll.
  await expectNoHorizontalScroll('report loaded @375px');

  // 6. Phone layout: no horizontal scroll on cars, refuelings and report.
  for (const width of [375, 360]) {
    await page.setViewportSize({ width, height: 667 });

    await page.goto('/cars');
    await expect(page.locator('.car-item', { hasText: 'Test Car' })).toBeVisible();
    await expectNoHorizontalScroll(`cars @${width}px`);

    await page.locator('.car-item', { hasText: 'Test Car' }).getByRole('link', { name: /refuelings/i }).click();
    await expect(page.getByRole('link', { name: /add refueling/i })).toBeVisible();
    await expectNoHorizontalScroll(`refuelings @${width}px`);

    await page.goto('/report');
    await expect(page.locator('.monthly-table tbody tr')).toHaveCount(1);
    await expectNoHorizontalScroll(`report @${width}px`);
  }

  // 7. Delete Test Car. The confirm text names its 2 refuelings, and the car is gone after.
  await page.goto('/cars');
  const testCar = page.locator('.car-item', { hasText: 'Test Car' });
  await testCar.getByRole('button', { name: 'Delete' }).click();
  const confirm = page.locator('.ant-modal-content');
  await expect(confirm).toContainText('Deleting this car also deletes its 2 refuelings.');
  await confirm.getByRole('button', { name: 'Confirm' }).click();
  await expect(testCar).toHaveCount(0);
  await expect(page.getByText(/you have no cars/i)).toBeVisible();

  // 8. Log out lands on /login, and a reload stays there.
  await page.getByRole('button', { name: /log out/i }).click();
  await expect(page).toHaveURL(/.*\/login/);
  await page.reload();
  await expect(page).toHaveURL(/.*\/login/);
});
