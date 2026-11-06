import { test, expect } from '@playwright/test';

test.describe('Admin KYC Failure (Late Revert / Out of Gas)', () => {
  // Admin dashboard is a desktop-only surface; skip on mobile viewports
  test.beforeEach(async ({}, testInfo) => {
    if (testInfo.project.name.includes('Mobile')) test.skip();
  });

  test('UI correctly handles transaction failing after submission', async ({ page }) => {
    // 1. Bypass the middleware by setting a dummy session cookie
    await page.context().addCookies([
      {
        name: 'session',
        value: 'dummy_token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
      },
      {
        name: 'is_logged_in',
        value: '1',
        domain: 'localhost',
        path: '/',
      }
    ]);

    // 2. Intercept backend APIs to mock an admin session and a pending buyer
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: {
            id: 'admin_id',
            wallet_address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
            role: 'ADMIN',
            verified_buyer: true,
          }
        }
      });
    });

    await page.route('**/api/auth/buyers', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          buyers: [
            {
              id: 'buyer_id_1',
              wallet_address: '0x1111222233334444555566667777888899990000',
              role: 'BUYER',
              verified_buyer: false,
              profile_name: 'Test Buyer',
            }
          ]
        }
      });
    });

    // Mock the Web3 window.ethereum provider to simulate late revert
    await page.addInitScript(() => {
      // @ts-ignore
      window.ethereum = {
        isMetaMask: true,
        request: async ({ method, params }: any) => {
          if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
            return ['0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'];
          }
          if (method === 'eth_chainId') {
            return '0x7a69'; // 31337
          }
          if (method === 'eth_sendTransaction') {
            // Transaction submitted successfully! Returns a tx hash.
            return '0x9999999999999999999999999999999999999999999999999999999999999999';
          }
          if (method === 'eth_getTransactionReceipt') {
            // Late failure: The RPC says the transaction was mined but REVERTED (status 0)
            return {
              transactionHash: params[0],
              blockNumber: '0x1b4',
              status: '0x0', // 0 indicates failure/revert!
            };
          }
          if (method === 'eth_call' || method === 'eth_estimateGas') {
            // bypass estimations
            return '0x01';
          }
          return null;
        },
        on: () => {},
        removeListener: () => {},
      };
    });

    // 3. Navigate to admin page
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Ensure we are logged in as admin and the mock buyer is visible
    await expect(page.getByText('Test Buyer')).toBeVisible();

    // 4. Click Approve KYC
    const approveBtn = page.getByRole('button', { name: /Approve KYC/i });
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // 5. The UI should catch the receipt.status === 0 and display the error
    // 5. Check if the error state is activated.
    const errorContainer = page.locator('p.text-red-400.font-mono');
    await expect(errorContainer).toBeVisible({ timeout: 5000 });
    const errorMessage = await errorContainer.textContent();
    console.log('Intercepted Error Message in UI:', errorMessage);

    // Verify it doesn't say success
    await expect(page.getByText(/Transaction confirmed!/i)).not.toBeVisible();
    
    // Verify the approve button returns to a clickable state (not stuck in loading)
    await expect(approveBtn).not.toBeDisabled();
  });
});
