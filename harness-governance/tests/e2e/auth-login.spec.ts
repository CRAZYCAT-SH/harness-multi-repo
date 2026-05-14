import { test, expect } from '@playwright/test';

/**
 * 用户登录流程 E2E 测试
 * 验证登录表单填写、提交、成功后跳转到任务列表页
 *
 * Requirements: 13.1, 13.2
 */
test.describe('用户登录', () => {
  // 测试前先注册一个用户
  const uniqueEmail = `login_test_${Date.now()}@example.com`;
  const password = 'password123';

  test.beforeAll(async ({ request }) => {
    // 通过 API 直接注册用户，为登录测试准备数据
    await request.post('/api/v1/auth/register', {
      data: { email: uniqueEmail, password },
    });
  });

  test('使用已注册账号成功登录后跳转到任务列表', async ({ page }) => {
    // 导航到登录页面
    await page.goto('/login');

    // 验证登录页面已加载
    await expect(page.getByTestId('page-login')).toBeVisible();

    // 填写登录表单
    await page.getByTestId('input-email').fill(uniqueEmail);
    await page.getByTestId('input-password').fill(password);

    // 点击提交按钮
    await page.getByTestId('btn-submit').click();

    // 验证登录成功后跳转到任务列表页
    await expect(page).toHaveURL(/\/tasks/);
    await expect(page.getByTestId('page-tasks')).toBeVisible();
  });

  test('使用错误密码登录时页面显示错误提示', async ({ page }) => {
    // 导航到登录页面
    await page.goto('/login');

    // 验证登录页面已加载
    await expect(page.getByTestId('page-login')).toBeVisible();

    // 填写正确邮箱但错误密码
    await page.getByTestId('input-email').fill(uniqueEmail);
    await page.getByTestId('input-password').fill('wrong_password_123');

    // 点击提交按钮
    await page.getByTestId('btn-submit').click();

    // 验证页面显示错误提示
    await expect(page.getByTestId('login-error')).toBeVisible();

    // 验证仍停留在登录页面，未跳转
    await expect(page).toHaveURL(/\/login/);
  });
});
