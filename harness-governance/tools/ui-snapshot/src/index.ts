/**
 * UI Snapshot — UI DOM 快照工具
 *
 * 使用 Playwright 抓取指定 URL 的 DOM 快照与页面截图，供代理观察 UI 状态。
 * 入口命令：pnpm agent:ui-snapshot <url>
 *
 * 功能：
 * 1. 导航到指定 URL
 * 2. 提取所有带 data-testid 属性的元素层级结构与文本内容
 * 3. 截取全页面截图
 * 4. 将结果保存到 .agent/ui-snapshots/ 目录
 *
 * @module ui-snapshot
 */

import { chromium } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * DOM 元素节点的结构化描述
 * 用于表示带 data-testid 的元素层级
 */
interface DomNode {
  /** 元素的 data-testid 属性值 */
  testId?: string;
  /** HTML 标签名（小写） */
  tag: string;
  /** 元素文本内容（截取前 100 字符） */
  text?: string;
  /** 子元素列表（仅包含带 testId 或有相关子元素的节点） */
  children?: DomNode[];
}

/**
 * DOM 快照输出结构
 */
interface DomSnapshot {
  /** 抓取的目标 URL */
  url: string;
  /** 快照生成时间（ISO 8601） */
  timestamp: string;
  /** DOM 元素层级结构 */
  elements: DomNode | null;
}

/**
 * 主函数 — 执行 UI 快照抓取流程
 *
 * 步骤：
 * 1. 从命令行参数获取目标 URL
 * 2. 启动 Chromium 浏览器并导航到目标页面
 * 3. 提取所有带 data-testid 的元素层级结构
 * 4. 截取全页面截图
 * 5. 将快照 JSON 和截图保存到 .agent/ui-snapshots/
 */
async function main(): Promise<void> {
  const url = process.argv[2];
  if (!url) {
    console.error('用法: pnpm agent:ui-snapshot <url>');
    process.exit(1);
  }

  // 输出目录：项目根目录下的 .agent/ui-snapshots/
  const outputDir = path.resolve(process.cwd(), '.agent', 'ui-snapshots');
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // 导航到目标 URL，等待页面加载完成
  await page.goto(url, { waitUntil: 'networkidle' });

  // 提取 DOM 结构（仅包含带 data-testid 的元素及其祖先路径）
  const elements = await page.evaluate(() => {
    /**
     * 递归提取元素树中带 data-testid 的节点
     * 保留从根到 testId 节点的完整路径
     */
    function extractElements(el: Element): DomNode | null {
      const testId = el.getAttribute('data-testid');
      const children = Array.from(el.children)
        .map(extractElements)
        .filter((c): c is DomNode => c !== null);

      // 仅保留自身带 testId 或子树中有相关节点的元素
      if (testId || children.length > 0) {
        return {
          testId: testId || undefined,
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.trim().slice(0, 100) || undefined,
          children: children.length > 0 ? children : undefined,
        };
      }
      return null;
    }

    return extractElements(document.body);
  });

  // 构建快照数据
  const snapshot: DomSnapshot = {
    url,
    timestamp: new Date().toISOString(),
    elements,
  };

  // 保存 DOM 快照 JSON
  const snapshotPath = path.join(outputDir, 'snapshot.json');
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));

  // 截取全页面截图
  const screenshotPath = path.join(outputDir, 'screenshot.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  await browser.close();

  console.log(`[ui-snapshot] 快照已保存到 ${outputDir}`);
  console.log(`  - DOM 快照: ${snapshotPath}`);
  console.log(`  - 页面截图: ${screenshotPath}`);
}

main().catch((err) => {
  console.error('[ui-snapshot] 执行失败:', err);
  process.exit(1);
});
