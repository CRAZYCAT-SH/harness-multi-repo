import { test, expect } from '@playwright/test';

/**
 * 创建任务流程 E2E 测试
 * 验证用户登录后可以创建新任务，任务出现在列表中
 *
 * Requirements: 13.1, 13.2
 */
test.describe('创建任务', () => {
  const uniqueEmail = `create_task_${Date.now()}@example.com`;
  const password = 'password123';

  test.beforeAll(async ({ request }) => {
    // 注册测试用户
    await request.post('/api/v1/auth/register', {
      data: { email: uniqueEmail, password },
    });
  });

  test('登录后成功创建新任务并在列表中显示', async ({ page }) => {
    // 先登录
    await page.goto('/login');
    await page.getByTestId('input-email').fill(uniqueEmail);
    await page.getByTestId('input-password').fill(password);
    await page.getByTestId('btn-submit').click();
    await expect(page).toHaveURL(/\/tasks/);

    // 点击创建任务按钮
    await page.getByTestId('btn-create-task').click();

    // 验证创建表单出现
    await expect(page.getByTestId('create-task-form')).toBeVisible();

    // 填写任务标题
    const taskTitle = `测试任务_${Date.now()}`;
    await page.getByTestId('input-new-task-title').fill(taskTitle);

    // 按 Enter 或点击创建按钮提交
    await page.getByTestId('input-new-task-title').press('Enter');

    // 验证新任务出现在列表中
    await expect(page.getByTestId('list-tasks')).toContainText(taskTitle);
  });
});
