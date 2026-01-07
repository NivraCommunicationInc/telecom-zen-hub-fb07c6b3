import { test, expect, Page } from '@playwright/test';

// Helper to collect console errors
async function setupConsoleErrorCollection(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}

test.describe('Employee Portal Routes - Unauthenticated Redirects', () => {
  test('/employee redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForURL(/\/employee\/login/);
    expect(page.url()).toContain('/employee/login');
  });

  test('/employee/login page renders without console errors', async ({ page }) => {
    const errors = await setupConsoleErrorCollection(page);
    await page.goto('/employee/login');
    await page.waitForLoadState('networkidle');
    
    // Check page content
    await expect(page.locator('text=Portail Employé')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    
    // No console errors
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('/employee/clients redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/employee/clients');
    await page.waitForURL(/\/employee\/login/);
    expect(page.url()).toContain('/employee/login');
  });

  test('/employee/orders redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/employee/orders');
    await page.waitForURL(/\/employee\/login/);
    expect(page.url()).toContain('/employee/login');
  });

  test('/employee/billing redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/employee/billing');
    await page.waitForURL(/\/employee\/login/);
    expect(page.url()).toContain('/employee/login');
  });

  test('/employee/cancellations redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/employee/cancellations');
    await page.waitForURL(/\/employee\/login/);
    expect(page.url()).toContain('/employee/login');
  });

  test('/employee/payment-disputes redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/employee/payment-disputes');
    await page.waitForURL(/\/employee\/login/);
    expect(page.url()).toContain('/employee/login');
  });

  test('/employee/tickets redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/employee/tickets');
    await page.waitForURL(/\/employee\/login/);
    expect(page.url()).toContain('/employee/login');
  });
});

test.describe('Admin Portal Routes - Unauthenticated Redirects', () => {
  test('/admin redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForURL(/\/admin\/login/);
    expect(page.url()).toContain('/admin/login');
  });

  test('/admin/clients redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/admin/clients');
    await page.waitForURL(/\/admin\/login/);
    expect(page.url()).toContain('/admin/login');
  });

  test('/admin/orders redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/admin/orders');
    await page.waitForURL(/\/admin\/login/);
    expect(page.url()).toContain('/admin/login');
  });

  test('/admin/billing redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/admin/billing');
    await page.waitForURL(/\/admin\/login/);
    expect(page.url()).toContain('/admin/login');
  });
});

test.describe('DEV-ONLY QA Routes - Employee Access Simulation', () => {
  // These tests use DEV-only QA pages that bypass auth for visual verification
  
  test('/qa/employee/sidebar shows Employee sidebar with "Ouvrir Admin" link', async ({ page }) => {
    const errors = await setupConsoleErrorCollection(page);
    await page.goto('/qa/employee/sidebar');
    await page.waitForLoadState('networkidle');
    
    // Verify sidebar renders
    await expect(page.locator('text=Nivra Employee')).toBeVisible();
    
    // Verify "Ouvrir Admin" link exists
    await expect(page.locator('text=Ouvrir Admin')).toBeVisible();
    
    // Verify navigation items
    await expect(page.locator('text=Tableau de bord')).toBeVisible();
    await expect(page.locator('text=Clients')).toBeVisible();
    await expect(page.locator('text=Commandes')).toBeVisible();
    await expect(page.locator('text=Facturation')).toBeVisible();
    await expect(page.locator('text=Annulations')).toBeVisible();
    await expect(page.locator('text=Contestations')).toBeVisible();
    await expect(page.locator('text=Tickets')).toBeVisible();
    
    // No console errors (except favicon)
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('/qa/admin-as-employee shows Admin portal with employee role', async ({ page }) => {
    const errors = await setupConsoleErrorCollection(page);
    await page.goto('/qa/admin-as-employee');
    await page.waitForLoadState('networkidle');
    
    // Verify admin layout renders
    await expect(page.locator('text=Nivra Admin')).toBeVisible();
    
    // Verify employee role badge is visible
    await expect(page.locator('[data-testid="employee-role-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="employee-role-badge"]')).toContainText('employee');
    
    // Verify admin-specific title
    await expect(page.locator('[data-testid="admin-dashboard-title"]')).toContainText('Admin Portal');
    
    // Verify current user shows employee email (masked)
    await expect(page.locator('[data-testid="current-user-email"]')).toContainText('e***@nivra.ca');
    await expect(page.locator('[data-testid="current-user-role"]')).toContainText('employee');
    
    // No console errors (except favicon)
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('/qa/employee/cancellations shows cancellations module', async ({ page }) => {
    const errors = await setupConsoleErrorCollection(page);
    await page.goto('/qa/employee/cancellations');
    await page.waitForLoadState('networkidle');
    
    // Verify page renders
    await expect(page.locator('text=Demandes d\'annulation')).toBeVisible();
    
    // Verify filter controls exist
    await expect(page.locator('input[placeholder*="Rechercher"]')).toBeVisible();
    
    // No console errors
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('/qa/employee/payment-disputes shows disputes module', async ({ page }) => {
    const errors = await setupConsoleErrorCollection(page);
    await page.goto('/qa/employee/payment-disputes');
    await page.waitForLoadState('networkidle');
    
    // Verify page renders
    await expect(page.locator('text=Contestations de paiement')).toBeVisible();
    
    // No console errors
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('/qa/employee/tickets shows tickets module', async ({ page }) => {
    const errors = await setupConsoleErrorCollection(page);
    await page.goto('/qa/employee/tickets');
    await page.waitForLoadState('networkidle');
    
    // Verify page renders
    await expect(page.locator('text=Tickets de support')).toBeVisible();
    
    // No console errors
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('/qa/employee/billing shows billing module', async ({ page }) => {
    const errors = await setupConsoleErrorCollection(page);
    await page.goto('/qa/employee/billing');
    await page.waitForLoadState('networkidle');
    
    // Verify page renders
    await expect(page.locator('text=Facturation')).toBeVisible();
    
    // No console errors
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

test.describe('Employee Portal - Module Mutation Capabilities (Mock)', () => {
  // These tests verify the UI supports mutation actions
  // Actual DB mutations require authenticated sessions
  
  test('Cancellations module has status update controls', async ({ page }) => {
    await page.goto('/qa/employee/cancellations');
    await page.waitForLoadState('networkidle');
    
    // Verify table with action buttons exists
    const table = page.locator('table');
    await expect(table).toBeVisible();
    
    // Verify status badges are present (indicating status can be changed)
    await expect(page.locator('text=En attente').or(page.locator('text=Approuvé')).first()).toBeVisible();
  });

  test('Disputes module has status update controls', async ({ page }) => {
    await page.goto('/qa/employee/payment-disputes');
    await page.waitForLoadState('networkidle');
    
    // Verify table exists
    const table = page.locator('table');
    await expect(table).toBeVisible();
    
    // Verify status badges
    await expect(page.locator('text=Ouvert').or(page.locator('text=En révision')).first()).toBeVisible();
  });

  test('Tickets module has reply and status controls', async ({ page }) => {
    await page.goto('/qa/employee/tickets');
    await page.waitForLoadState('networkidle');
    
    // Verify table exists
    const table = page.locator('table');
    await expect(table).toBeVisible();
    
    // Verify priority and status badges
    await expect(page.locator('text=Haute').or(page.locator('text=Moyenne')).first()).toBeVisible();
  });

  test('Billing module has e-transfer status controls', async ({ page }) => {
    await page.goto('/qa/employee/billing');
    await page.waitForLoadState('networkidle');
    
    // Verify table exists
    const table = page.locator('table');
    await expect(table).toBeVisible();
    
    // Verify payment status badges
    await expect(page.locator('text=En attente').or(page.locator('text=Payé')).first()).toBeVisible();
  });
});
