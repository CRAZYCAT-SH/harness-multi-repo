import { test, expect } from '@playwright/test';

/**
 * 删除任务流程 E2E 测试
 * 验证用户点击删除按钮后弹出确认对话框，确认后任务从列表中消失
 */
test.describe('删除任务', () => {
  const uniqueEmail = `delete_task_${Date.now()}@example.com`;
  const password = 'password123';
  const taskTitle = `待删除任务_${Date.now()}`;

  test('点击删除按钮后确认对话框出现，确认后任务消失', async ({ page }) => {
    // 先注册
    await page.goto('/register');
    await page.getByTestId('input-email').fill(uniqueEmail);
    await page.getByTestId('input-password').fill(password);
    await page.getByTestId('btn-submit').click();
    await expect(page).toHaveURL(/\/login/);

    // 登录
    await page.getByTestId('input-email').fill(uniqueEmail);
    await page.getByTestId('input-password').fill(password);
    await page.getByTestId('btn-submit').click();
    await expect(page).toHaveURL(/\/tasks/);

    // 创建一个任务
    await page.getByTestId('btn-create-task').click();
    await page.getByTestId('input-new-task-title').fill(taskTitle);
    await page.getByTestId('input-new-task-title').press('Enter');
    await expect(page.getByTestId('list-tasks')).toContainText(taskTitle);

    // 点击删除按钮
    const deleteBtn = page.getByTestId('list-tasks').locator('[data-testid^="btn-delete-"]').first();
    await deleteBtn.click();

    // 验证确认对话框出现
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();

    // 点击确认删除
    await page.getByTestId('btn-confirm').click();

    // 验证任务从列表中消失
    await expect(page.getByTestId('list-tasks')).not.toContainText(taskTitle, { timeout: 10000 });
  });
});
