import { test, expect } from '@playwright/test';

/**
 * 用户注册流程 E2E 测试
 * 验证注册表单填写、提交、成功后跳转到登录页
 *
 * Requirements: 13.1, 13.2
 */
test.describe('用户注册', () => {
  test('成功注册新用户后跳转到登录页', async ({ page }) => {
    // 使用时间戳生成唯一邮箱，避免重复注册冲突
    const uniqueEmail = `test_${Date.now()}@example.com`;
    const password = 'password123';

    // 导航到注册页面
    await page.goto('/register');

    // 验证注册页面已加载
    await expect(page.getByTestId('page-register')).toBeVisible();

    // 填写注册表单
    await page.getByTestId('input-email').fill(uniqueEmail);
    await page.getByTestId('input-password').fill(password);

    // 点击提交按钮
    await page.getByTestId('btn-submit').click();

    // 验证注册成功后跳转到登录页
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId('page-login')).toBeVisible();
  });
});
