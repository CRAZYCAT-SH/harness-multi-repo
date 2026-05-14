import { test, expect } from '@playwright/test';

/**
 * 编辑任务流程 E2E 测试
 * 验证用户可以点击任务进入详情页，修改标题后保存
 *
 * Requirements: 13.1, 13.2
 */
test.describe('编辑任务', () => {
  const uniqueEmail = `edit_task_${Date.now()}@example.com`;
  const password = 'password123';
  let authToken = '';

  test.beforeAll(async ({ request }) => {
    // 注册并登录获取 token
    await request.post('/api/v1/auth/register', {
      data: { email: uniqueEmail, password },
    });
    const loginRes = await request.post('/api/v1/auth/login', {
      data: { email: uniqueEmail, password },
    });
    const loginData = await loginRes.json();
    authToken = loginData.token;

    // 通过 API 创建一个任务用于编辑测试
    await request.post('/api/v1/tasks', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { title: '待编辑任务' },
    });
  });

  test('点击任务进入详情页并修改标题后保存', async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.getByTestId('input-email').fill(uniqueEmail);
    await page.getByTestId('input-password').fill(password);
    await page.getByTestId('btn-submit').click();
    await expect(page).toHaveURL(/\/tasks/);

    // 点击任务进入详情页
    await page.getByText('待编辑任务').click();

    // 验证进入任务详情编辑页
    await expect(page.getByTestId('page-task-detail')).toBeVisible();
    await expect(page.getByTestId('form-task-edit')).toBeVisible();

    // 修改标题
    const newTitle = `已编辑任务_${Date.now()}`;
    await page.getByTestId('input-title').clear();
    await page.getByTestId('input-title').fill(newTitle);

    // 点击保存
    await page.getByTestId('btn-save').click();

    // 验证保存成功（标题已更新）
    await expect(page.getByTestId('input-title')).toHaveValue(newTitle);
  });
});
