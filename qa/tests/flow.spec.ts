import { test, expect } from '@playwright/test';

// ────────────────────────────────────────────
// 1. Landing / Login Page – renders correctly
// ────────────────────────────────────────────
test.describe('Login Page', () => {
  test('renders the Authenticate Protocol card', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Core heading
    await expect(page.getByText('Authenticate Protocol')).toBeVisible();

    // Web3 connect CTA
    await expect(page.getByText('Connect Web3 Wallet')).toBeVisible();

    // Registration link
    const initLink = page.locator('a[href="/register"]');
    await expect(initLink).toBeVisible();

    console.log('[Login] Console errors:', errors.length ? errors : 'None');
  });

  test('shows MetaMask error when wallet not present', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Click the connect button (no MetaMask injected in Playwright)
    await page.getByText('Connect Web3 Wallet').click();

    // Should show an error about missing wallet
    await expect(page.getByText(/wallet not detected/i)).toBeVisible({ timeout: 5000 });
  });
});

// ────────────────────────────────────────────
// 2. Register Page – renders correctly
// ────────────────────────────────────────────
test.describe('Register Page', () => {
  test('renders the Initialize Node card with role selection', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Core heading
    await expect(page.getByText('Initialize Node')).toBeVisible();

    // Role buttons
    await expect(page.getByText('BUYER')).toBeVisible();
    await expect(page.getByText('RESEARCHER')).toBeVisible();

    // Login link
    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();

    console.log('[Register] Console errors:', errors.length ? errors : 'None');
  });

  test('role selection toggles active state', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Click BUYER
    await page.getByRole('button', { name: 'BUYER' }).click();
    // The button should now have the active state (cyan text)
    const buyerBtn = page.getByRole('button', { name: 'BUYER' });
    await expect(buyerBtn).toHaveClass(/text-cyan-400/);

    // Click RESEARCHER
    await page.getByRole('button', { name: 'RESEARCHER' }).click();
    const researcherBtn = page.getByRole('button', { name: 'RESEARCHER' });
    await expect(researcherBtn).toHaveClass(/text-cyan-400/);
  });
});

// ────────────────────────────────────────────
// 3. Auth Guards – protected routes redirect
// ────────────────────────────────────────────
test.describe('Auth Guards (Unauthenticated)', () => {
  test('/listings redirects to /login', async ({ page }) => {
    await page.goto('/listings');
    await page.waitForURL('**/login');
    await expect(page.getByText('Authenticate Protocol')).toBeVisible();
  });

  test('/submit redirects to /login', async ({ page }) => {
    await page.goto('/submit');
    await page.waitForURL('**/login');
    await expect(page.getByText('Authenticate Protocol')).toBeVisible();
  });

  test('/admin redirects to /login', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForURL('**/login');
    await expect(page.getByText('Authenticate Protocol')).toBeVisible();
  });
});

// ────────────────────────────────────────────
// 4. Backend API – health checks
// ────────────────────────────────────────────
test.describe('Backend API Health', () => {
  test('GET /api/listings returns 200 from backend', async ({ request }) => {
    const res = await request.get('http://localhost:3001/api/listings');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('listings');
    console.log(`[API] Listings count: ${body.listings.length}`);
  });

  test('GET /api/auth/csrf-token returns a token', async ({ request }) => {
    const res = await request.get('http://localhost:3001/api/auth/csrf-token');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('csrfToken');
    expect(body.csrfToken.length).toBeGreaterThan(10);
  });

  test('GET /api/auth/nonce returns a nonce string', async ({ request }) => {
    const res = await request.get('http://localhost:3001/api/auth/nonce?address=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    expect(res.status()).toBe(200);
    const nonce = await res.text();
    expect(nonce.length).toBeGreaterThan(5);
  });

  test('POST /api/listings without auth returns 401', async ({ request }) => {
    const res = await request.post('http://localhost:3001/api/listings', {
      data: { title: 'hack' },
    });
    expect(res.status()).toBe(401);
  });
});

// ────────────────────────────────────────────
// 5. Responsive – critical elements visible at both viewports
// ────────────────────────────────────────────
test.describe('Responsive Layout Checks', () => {
  test('login card is fully visible and not overflowing', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const card = page.locator('[class*="backdrop-blur"]').first();
    await expect(card).toBeVisible();

    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const viewport = page.viewportSize();
      if (viewport) {
        // Card should not overflow the viewport width
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 2); // +2 for rounding
      }
    }
  });
});

// ────────────────────────────────────────────
// 6. Navigation flow – Login → Register → Login
// ────────────────────────────────────────────
test.describe('Navigation Flow', () => {
  test('can navigate login → register → login', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Authenticate Protocol')).toBeVisible();

    // Click "Initialize →" link to register
    await page.locator('a[href="/register"]').click();
    await page.waitForURL('**/register');
    await expect(page.getByText('Initialize Node')).toBeVisible();

    // Click login link back
    await page.locator('a[href="/login"]').click();
    await page.waitForURL('**/login');
    await expect(page.getByText('Authenticate Protocol')).toBeVisible();
  });
});
