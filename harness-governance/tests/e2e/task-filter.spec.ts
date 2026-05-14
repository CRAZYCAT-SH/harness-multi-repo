import { test, expect } from '@playwright/test';

/**
 * 过滤任务列表 E2E 测试
 * 验证用户可以通过状态下拉框过滤任务列表
 *
 * Requirements: 13.1, 13.2
 */
test.describe('过滤任务列表', () => {
  const uniqueEmail = `filter_task_${Date.now()}@example.com`;
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

    // 创建不同状态的任务用于过滤测试
    await request.post('/api/v1/tasks', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { title: '待处理任务A' },
    });

    // 创建一个任务并更新为 done 状态
    const createRes = await request.post('/api/v1/tasks', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { title: '已完成任务B' },
    });
    const createdTask = await createRes.json();
    await request.patch(`/api/v1/tasks/${createdTask.id}`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { status: 'done' },
    });
  });

  test('选择状态过滤器后列表内容相应变化', async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.getByTestId('input-email').fill(uniqueEmail);
    await page.getByTestId('input-password').fill(password);
    await page.getByTestId('btn-submit').click();
    await expect(page).toHaveURL(/\/tasks/);

    // 验证初始状态下两个任务都可见
    await expect(page.getByTestId('list-tasks')).toContainText('待处理任务A');
    await expect(page.getByTestId('list-tasks')).toContainText('已完成任务B');

    // 选择"已完成"状态过滤
    await page.getByTestId('select-status').selectOption('done');

    // 验证只显示已完成的任务
    await expect(page.getByTestId('list-tasks')).toContainText('已完成任务B');
    await expect(page.getByTestId('list-tasks')).not.toContainText('待处理任务A');

    // 选择"待处理"状态过滤
    await page.getByTestId('select-status').selectOption('pending');

    // 验证只显示待处理的任务
    await expect(page.getByTestId('list-tasks')).toContainText('待处理任务A');
    await expect(page.getByTestId('list-tasks')).not.toContainText('已完成任务B');
  });
});
