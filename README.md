# 知乎免登录浏览增强版 / Zhihu No-Login Browse Enhanced

> 绕过知乎登录限制，无需注册即可正常浏览知乎内容。
>
> Bypass Zhihu's login restrictions and browse content without registration.

**版本 / Version**: v4.2.1 | **许可 / License**: MIT | **兼容 / Compatible**: Tampermonkey / Violentmonkey / Greasemonkey

---

## 目录 / Table of Contents

- [一键安装 / Quick Install](#一键安装--quick-install)
- [功能特性 / Features](#功能特性--features)
- [使用说明 / Usage Guide](#使用说明--usage-guide)
- [技术说明 / Technical Details](#技术说明--technical-details)
- [已知限制 / Known Limitations](#已知限制--known-limitations)
- [调试方法 / Debugging](#调试方法--debugging)
- [常见问题 / FAQ](#常见问题--faq)
- [更新日志 / Changelog](#更新日志--changelog)

---

## 一键安装 / Quick Install

**前置条件 / Prerequisites**: 浏览器需安装以下任一用户脚本管理器 / Install one of these userscript managers:

| 管理器 / Manager | Chrome | Firefox | Edge | Safari |
|---|---|---|---|---|
| [Tampermonkey](https://www.tampermonkey.net/) | Yes | Yes | Yes | Yes |
| [Violentmonkey](https://violentmonkey.github.io/) | Yes | Yes | Yes | - |
| [Greasemonkey](https://www.greasespot.net/) | - | Yes | - | - |

**安装脚本 / Install Script**:

点击下方链接，在弹出的安装页面中点击"安装"按钮：
Click the link below, then click "Install" on the popup page:

### [>>> 点击安装 / Click to Install <<<](https://raw.githubusercontent.com/ai2master/zhihu-no-login/main/zhihu-bypass-login.user.js)

安装后刷新知乎页面即可生效。
Refresh any Zhihu page after installation to take effect.

---

## 功能特性 / Features

### 1. 登录弹窗移除 / Login Modal Removal

| 功能 / Feature | 说明 / Description |
|---|---|
| 登录流程弹窗 | 移除 `.signFlowModal` 知乎登录/注册弹窗 |
| Login flow modal | Removes `.signFlowModal` Zhihu login/register modals |
| 通用弹窗 | 移除含"登录/注册/密码/扫码"文案的 Modal-wrapper |
| Generic modal | Removes Modal-wrappers containing login-related text |
| Fixed 浮窗 | 移除右下角 fixed 定位的"登录即可查看"提示框 |
| Fixed popup | Removes bottom-right fixed "Login to view" prompt |
| 内嵌面板 | 隐藏"登录知乎，您可以享受以下权益"推广面板 |
| Inline panel | Hides "Login to enjoy benefits" promotion panels |

**工作方式 / How it works**: 分 5 步检测，从精确类名匹配到浅层 DOM 扫描再到全量文本匹配，确保覆盖所有弹窗变体。
Uses 5-step detection from exact class matching to shallow DOM scan to full text matching, covering all modal variants.

### 2. 滚动锁定解除 / Scroll Lock Removal

知乎弹窗会设置 `overflow: hidden` 锁定页面。本脚本：
Zhihu modals set `overflow: hidden` to lock the page. This script:

- 清除 `<html>` 和 `<body>` 的 `overflow: hidden`
  Clears `overflow: hidden` from `<html>` and `<body>`
- 清除弹窗留下的 `padding-right`
  Clears leftover `padding-right` from modals
- MutationObserver 持续监控，防止知乎 JS 再次锁定
  MutationObserver continuously monitors, preventing re-locking

### 3. 回答浏览扩展 / Extended Answer Viewing

**问题 / Problem**: 知乎未登录用户只能看到 3 条回答。

**解决方案 / Solution**:
- 从 `default`（默认排序）和 `updated`（时间排序）两个 SSR 页面分别提取回答
  Fetches answers from both `default` and `updated` sort SSR pages
- 合并去重后最多显示约 6 条回答
  After deduplication, shows up to ~6 answers
- 新回答以卡片形式展示（作者、内容、赞同数、评论数）
  New answers displayed as cards (author, content, upvotes, comments)

### 4. 内置回答浏览器 / Built-in Answer Browser

加载更多回答后，提供 iframe 浏览器：
After loading more answers, provides an iframe browser:

- **上一条/下一条** 导航按钮 / **Previous/Next** navigation buttons
- **回答编号药丸** 支持跳转到任意回答 / **Answer number pills** for jumping to any answer
- **fxzhihu.com 开关** 可切换使用第三方代理（Cloudflare Workers，无登录限制）/ **fxzhihu.com toggle** switches to third-party proxy (no login wall)
- 每条回答同时显示知乎原链和 fxzhihu 链接 / Each answer shows both Zhihu and fxzhihu links

### 5. 原生搜索恢复 + 外部引擎备选 / Native Search + External Engine Fallback

知乎搜索需要 `__zse_ck` cookie（浏览器自动生成）。首次访问可能无结果。
Zhihu search requires `__zse_ck` cookie (browser-generated). First visit may yield no results.

本脚本的处理策略 / Script's strategy:
1. **等待 2.5 秒** 检测原生搜索是否有结果 / Wait 2.5s to check native results
2. 如有结果则不干预 / If results found, don't intervene
3. 如无结果，注入备选面板 / If no results, inject fallback panel:
   - **方法一**: 引导用户先浏览几个知乎页面生成 cookie，再刷新搜索页 / Guide user to browse pages to generate cookie, then refresh
   - **方法二**: 提供 Google / Bing / 百度 / 搜狗 四个搜索引擎入口，自动添加 `site:zhihu.com` 限定 / Provides 4 search engines with auto `site:zhihu.com` restriction
   - 输入框支持实时编辑关键词，按 Enter 更新所有引擎链接 / Input field supports live keyword editing, Enter updates all links

### 6. 自动展开折叠内容 / Auto-Expand Collapsed Content

- 移除 `RichContent-inner` 的 `max-height` 限制 / Removes `max-height` restriction on `RichContent-inner`
- 自动点击"阅读全文"/"展开阅读全文"按钮 / Auto-clicks "Read full text" / "Expand full text" buttons

### 7. 登录页跳转拦截 / Login Redirect Interception

- **History API Hook**: 拦截 `pushState` / `replaceState` 中的 `/signin` 和 `/login` 跳转 / Intercepts `/signin` and `/login` navigations in pushState/replaceState
- **已在登录页**: 自动跳回来源页（referrer），无来源则跳到[知乎热榜](https://www.zhihu.com/hot) / Auto-redirects back to referrer, or to Hot List if no referrer

### 8. 用户主页浏览助手 / User Profile Browsing Helper

**问题 / Problem**: 知乎自 2024 年 5 月起在服务端屏蔽未登录用户查看个人主页（数据不返回，无法前端绕过）。
Since May 2024, Zhihu blocks profile content server-side for non-logged-in users.

**解决方案 / Solution**: 注入"内容浏览助手"面板 / Injects a "Content Browsing Helper" panel:

- 从 `js-initialData` 提取用户基本信息（姓名、回答数、文章数）/ Extracts user info from `js-initialData`
- 提供 Google / Bing / 百度 / 搜狗 搜索入口 / Provides 4 search engine entries
- 统计信息卡片显示回答数和文章数 / Stats card showing answer and article counts

### 9. 盐选广告折叠 / Salt-Select Ad Collapsing

自动折叠知乎"盐选"付费内容推广（通过 `.KfeCollection-AnswerTopCard-Container` 标识检测）。
Auto-collapses "Salt Select" paid content promotions.

### 10. 链接重定向清理 / Link Redirect Cleanup

将 `link.zhihu.com/?target=URL` 格式的外部链接恢复为原始 URL，移除知乎的链接跟踪中转。
Restores `link.zhihu.com/?target=URL` external links to original URLs, removing Zhihu's link tracking.

---

## 使用说明 / Usage Guide

### 基本使用 / Basic Usage

安装脚本后，访问以下知乎页面即可自动生效：
After installation, the script works automatically on these Zhihu pages:

| 页面类型 / Page Type | URL 示例 / URL Example | 脚本行为 / Script Behavior |
|---|---|---|
| 问题页 / Question | `zhihu.com/question/12345` | 移除弹窗 + 展开内容 + 解锁更多回答 |
| 回答页 / Answer | `zhihu.com/question/12345/answer/67890` | 移除弹窗 + 展开内容 |
| 搜索页 / Search | `zhihu.com/search?q=keyword` | 检测结果，无结果时注入备选面板 |
| 用户主页 / Profile | `zhihu.com/people/username` | 注入内容浏览助手面板 |
| 热榜 / Hot | `zhihu.com/hot` | 移除弹窗 + 展开内容 |
| 首页 / Home | `zhihu.com/` | 移除弹窗 + 展开内容 |

### 加载更多回答 / Loading More Answers

1. 访问任意问题页（如 `zhihu.com/question/12345`） / Visit any question page
2. 滚动到回答列表底部，找到蓝色的 **"加载更多回答"** 按钮 / Scroll to bottom, find the blue **"Load More Answers"** button
3. 点击按钮，等待加载完成 / Click the button, wait for loading
4. 新回答以卡片形式展示在下方 / New answers appear as cards below
5. 使用 **iframe 回答浏览器** 逐条查看完整内容 / Use **iframe browser** to view full content

### 使用 fxzhihu.com 代理 / Using fxzhihu.com Proxy

在回答浏览器中，打开 **fxzhihu.com 开关**（右上角 toggle），iframe 将使用第三方代理加载：
In the answer browser, turn on the **fxzhihu.com toggle** (top-right):

- fxzhihu.com 是基于 Cloudflare Workers 的第三方代理 / Third-party proxy based on Cloudflare Workers
- 无登录限制，可完整查看回答内容 / No login restrictions, full answer content viewable
- 注意：非知乎官方服务 / Note: Not an official Zhihu service

### 搜索使用技巧 / Search Tips

如果搜索页无结果 / If search page shows no results:

1. **推荐方法**: 先浏览 2-3 个知乎问题页面（如[热榜](https://www.zhihu.com/hot)），让浏览器自动生成 `__zse_ck` cookie，然后回到搜索页刷新 / **Recommended**: Browse 2-3 pages first, then refresh search
2. **快捷方法**: 使用脚本注入的外部搜索引擎面板 / **Quick**: Use the injected external search panel

---

## 技术说明 / Technical Details

### 架构概览 / Architecture Overview

```
脚本执行时序 / Script Execution Timeline
==========================================

[document-start]                     <- @run-at document-start
  |
  +-- fetch API hook                 <- 拦截 403 need_login 响应
  +-- earlyObs (MutationObserver)    <- 监控 js-initialData 插入
  +-- history API hook               <- 拦截登录页跳转
  +-- login page redirect check      <- 已在登录页则跳回
  +-- CSS injection                  <- 注入样式表
       |
[DOMContentLoaded]                   <- onReady() 触发
  |
  +-- patchInitialData()             <- patch needForceLogin / isDrained
  +-- executeBypass()                <- 首次完整清理
  +-- setupObserver()                <- 启动 DOM 监控
  +-- handleSearchPage()             <- 搜索页处理
  +-- handleProfilePage()            <- 用户主页处理
  +-- removeRedirects()              <- 清理链接
  +-- setInterval (500ms x 10)       <- 5 秒定时器兜底
  +-- scroll listener                <- 滚动时恢复 scroll
       |
[持续运行 / Ongoing]
  |
  +-- MutationObserver               <- 监控 DOM 变化，触发清理
  +-- overflow MutationObserver      <- 监控 html overflow 属性
```

### 核心技术点 / Key Technical Points

#### 1. SSR 数据拦截 / SSR Data Interception

知乎使用 SSR（服务端渲染），页面 HTML 包含 `<script id="js-initialData">`：
Zhihu uses SSR, HTML contains `<script id="js-initialData">`:

```javascript
// 知乎 SSR 数据结构 / Zhihu SSR data structure
{
  "initialState": {
    "question": {
      "answers": {
        "12345": {
          "needForceLogin": true,  // <- 脚本改为 false
          "isDrained": true,       // <- 脚本改为 false
          "ids": [...]
        }
      }
    },
    "entities": {
      "answers": { "67890": { ... }, ... }
    }
  }
}
```

#### 2. Fetch Hook 策略 / Fetch Hook Strategy

```javascript
// 只拦截回答/feed 相关的 403，不影响其他 API
// Only intercept answer/feed 403s, don't affect other APIs
if (response.status === 403 && (url.includes('/feeds') || url.includes('/answers'))) {
    if (data?.error?.need_login || data?.error?.code === 40353) {
        // 返回空数据，前端认为"没有更多回答了"
        return new Response(JSON.stringify({ data: [], paging: { is_end: true } }));
    }
}
```

#### 3. 浅层 DOM 扫描优化 / Shallow DOM Scan Optimization

```javascript
// 传统方法：遍历所有 div（约 3000-5000 个） / Traditional: ~3000-5000 divs
document.querySelectorAll('div')

// 优化方法：只遍历 body 子节点 + 一级孙节点（约 30 个）
// Optimized: only body children + grandchildren (~30)
for (const child of document.body.children) {
    if (child.tagName === 'DIV') {
        shallowDivs.push(child);
        for (const gc of child.children) {
            if (gc.tagName === 'DIV') shallowDivs.push(gc);
        }
    }
}
// 原理：fixed/sticky 元素必须位于 DOM 浅层才能正确渲染
// Reason: fixed/sticky elements must be in shallow DOM per CSS spec
```

#### 4. 时间戳节流 / Timestamp Throttle

```javascript
let _lastBypass = 0;
function executeBypass() {
    const now = Date.now();
    if (now - _lastBypass < 200) return;  // 200ms 内不重复执行
    _lastBypass = now;
    // ... 执行清理操作
}
// 三个触发源（定时器/Observer/滚动）在密集触发时自动去重
// Three trigger sources auto-deduplicate during burst firing
```

#### 5. 多排序合并策略 / Multi-Sort Merge Strategy

```
知乎 SSR 每种排序返回 3 条回答 / Zhihu SSR returns 3 answers per sort:

default 排序: [A, B, C]
updated 排序: [B, D, E]     <- B 与 default 重复 / B overlaps

合并去重后 / After merge + dedup: [A, B, C, D, E] = 5 条
最多可获得 ~6 条 / Up to ~6 answers when sorts are completely different
```

### 脚本内部模块 / Internal Modules

| 模块 / Module | 功能 / Function |
|---|---|
| Part 1: document-start 拦截 | fetch hook + initialData patch |
| Part 2: 跳转拦截 | history API hook + redirect |
| Part 3: CSS 样式系统 | 完整 UI 组件样式 / Full UI component styles |
| Part 4: DOM 操作 | 弹窗移除 + 滚动恢复 + 内容展开 |
| Part 5: 回答扩展 | SSR 数据提取 + 多排序合并 + iframe 浏览器 |
| Part 6: 搜索优化 | 原生搜索检测 + 备选面板 |
| Part 7: 主页增强 | 用户信息提取 + 搜索引擎入口 |
| Part 8: 初始化 | Observer + 定时器 + 调试接口 |

### CSS 类名体系 / CSS Class System

所有自定义类名以 `zhBypass-` 为前缀，避免与知乎原生样式冲突：
All custom classes prefixed with `zhBypass-` to avoid conflicts:

| 类名 / Class | 用途 / Purpose |
|---|---|
| `zhBypass-panel` | 面板容器 / Panel container |
| `zhBypass-card` | 回答卡片 / Answer card |
| `zhBypass-btn` | 按钮 / Button |
| `zhBypass-btn-primary` | 主按钮 / Primary button |
| `zhBypass-btn-success` | 成功按钮 / Success button |
| `zhBypass-btn-warning` | 警告按钮 / Warning button |
| `zhBypass-navBtn` | 导航按钮 / Navigation button |
| `zhBypass-pill` | 编号药丸 / Number pill |
| `zhBypass-pill--active` | 当前选中的药丸 / Active pill |
| `zhBypass-engineBtn` | 搜索引擎按钮 / Search engine button |
| `zhBypass-engineIcon` | 引擎图标 / Engine icon |
| `zhBypass-switch` | Toggle 开关 / Toggle switch |
| `zhBypass-toggleLabel` | Toggle 标签 / Toggle label |
| `zhBypass-input` | 输入框 / Input field |
| `zhBypass-iframe` | iframe 容器 / iframe container |
| `zhBypass-heading` | 标题 / Heading |
| `zhBypass-subheading` | 副标题 / Subheading |
| `zhBypass-subtext` | 副文本 / Subtext |
| `zhBypass-hint` | 提示文字 / Hint text |
| `zhBypass-tag` | 标签 / Tag |
| `zhBypass-link` | 链接 / Link |
| `zhBypass-infoBox` | 信息框 / Info box |
| `zhBypass-warningBox` | 警告框 / Warning box |
| `zhBypass-countBadge` | 计数徽章 / Count badge |
| `zhBypass-grid-2` | 2 列网格 / 2-column grid |
| `zhBypass-grid-4` | 4 列网格 / 4-column grid |
| `zhBypass-flexCenter` | Flex 居中 / Flex center |
| `zhBypass-flexBetween` | Flex 两端对齐 / Flex space-between |
| `zhBypass-divider` | 分隔线 / Divider |
| `zhBypass-idList` | 回答 ID 列表 / Answer ID list |
| `zhBypass-browserNav` | 浏览器导航栏 / Browser navigation bar |

### 与其他脚本的兼容性 / Compatibility with Other Scripts

| 脚本 / Script | 兼容措施 / Compatibility Measure |
|---|---|
| 知乎增强 (XIU2) | 使用不同的 namespace，不重复处理已移除的弹窗 |
| 知乎免登录 (396171) | 使用 `__zhBypassEnhanced` 防止重复初始化 |
| 知乎免登录 (415278) | 使用不同的 `_zhBypassPatched` 标记 |
| simpleZhiHu | 不劫持搜索框，避免冲突 |

防冲突机制 / Anti-conflict mechanisms:
- `@namespace` 使用唯一标识 `zhihu-bypass-login-enhanced`
- 全局标记 `window.__zhBypassEnhanced` 防止重复执行
- DOM 元素使用 `zhBypass-` 前缀的类名
- `@grant none` 最小权限

---

## 已知限制 / Known Limitations

| 限制 / Limitation | 原因 / Reason | 影响 / Impact |
|---|---|---|
| 最多加载约 6 条回答 | API 需要 `x-zse-96` 加密签名 | 无法获取全部回答 |
| Max ~6 answers | API requires encrypted signature | Cannot get all answers |
| 用户主页内容不可见 | 服务端不返回数据（2024.5 起） | 只能通过搜索引擎间接访问 |
| Profile content blocked | Server doesn't return data | Only via search engines |
| 首次搜索可能无结果 | 缺少 `__zse_ck` cookie | 需先浏览几个页面 |
| First search may fail | Missing `__zse_ck` cookie | Browse pages first |
| 验证码需手动完成 | 知乎反爬机制 | 验证后搜索恢复正常 |
| Captcha manual only | Anti-bot mechanism | Works after verification |
| 互动功能不可用 | 点赞/评论/收藏需要登录 | 只能浏览不能互动 |
| No interaction | Upvote/comment/bookmark need login | Read-only access |

---

## 调试方法 / Debugging

### 控制台日志 / Console Logs

所有日志以 `[知乎免登录]` 为前缀，在浏览器控制台（F12）中可过滤查看：
All logs prefixed with `[知乎免登录]`, filterable in browser console (F12):

```
[知乎免登录] 初始化 v4.2.1
[知乎免登录] 已 patch initialData (needForceLogin / isDrained)
[知乎免登录] 拦截 403 need_login: https://www.zhihu.com/api/v4/questions/12345/feeds
[知乎免登录] 已移除登录弹窗
[知乎免登录] 已替换"查看剩余回答"按钮
[知乎免登录] 加载完成：新增 3 条，共 6 条可浏览
[知乎免登录] 搜索页有原生结果，无需干预
[知乎免登录] 已在用户主页注入内容浏览助手
[知乎免登录] 阻止 history 跳转到登录页: /signin
[知乎免登录] 初始化完成
```

### 调试 API / Debug API

在浏览器控制台输入 / Type in browser console:

```javascript
// 查看版本 / Check version
zhihuBypass.version  // -> "4.2.1"

// 手动触发弹窗移除 / Manually remove modals
zhihuBypass.removeModal()

// 手动恢复滚动 / Manually restore scroll
zhihuBypass.restoreScroll()

// 手动展开内容 / Manually expand content
zhihuBypass.expandContent()

// 手动执行完整清理 / Manual full cleanup
zhihuBypass.executeBypass()

// 构建外部搜索 URL / Build external search URL
zhihuBypass.buildSearchUrl('google', '人工智能')
```

---

## 常见问题 / FAQ

**Q: 安装后没有效果？/ Script doesn't work?**
A: 确认脚本管理器已启用脚本。打开 F12 控制台，搜索 `[知乎免登录]`。无日志说明脚本未运行，检查 Tampermonkey 设置。
Confirm script is enabled in manager. Open F12, search `[知乎免登录]`. No logs means script isn't running.

**Q: 搜索一直无结果？/ Search always empty?**
A: 先浏览 2-3 个知乎问题页面（如[热榜](https://www.zhihu.com/hot)），然后刷新搜索页。如果弹出验证码，完成验证即可。也可用备选面板中的外部搜索引擎。
Browse 2-3 pages first, then refresh search. Complete captcha if prompted.

**Q: 为什么只能加载约 6 条回答？/ Why only ~6 answers?**
A: 知乎 API 使用 `x-zse-96` 加密签名保护，脚本无法模拟。当前方案通过合并两种排序的 SSR 页面数据，最多约 6 条。
Zhihu API is protected by encrypted signature. Current approach merges two sort orders.

**Q: 用户主页看不到内容？/ No profile content?**
A: 知乎服务端限制（2024 年 5 月起），服务器不返回数据，无法前端绕过。脚本提供了搜索引擎替代方案。
Server-side restriction since May 2024. Script provides search engine alternatives.

**Q: 与其他知乎脚本冲突？/ Conflicts with other scripts?**
A: 脚本使用 `window.__zhBypassEnhanced` 单例守卫。如有冲突，建议禁用其他知乎相关脚本。
Uses singleton guard. Disable other Zhihu scripts if conflicts occur.

**Q: 页面偶尔闪烁一下弹窗？/ Modal flashes briefly?**
A: CSS 在 document-start 阶段注入，通常不会闪烁。如果闪烁说明知乎更新了弹窗类名，请更新脚本。
CSS is injected at document-start. Flash means Zhihu updated class names, update the script.

---

## 更新日志 / Changelog

### v4.2.1
- 性能优化：浅层 DOM 扫描替代全量 div 遍历（~30 vs ~3000 个元素）/ Shallow DOM scan (~30 vs ~3000)
- 性能优化：200ms 时间戳节流合并重复调用 / 200ms timestamp throttle
- 性能优化：定时器从 20 次减少到 10 次 / Timer reduced from 20 to 10 iterations
- 性能优化：滚动处理简化为仅恢复 scroll / Scroll simplified to restoreScroll only

### v4.2.0
- UI 全面美化：卡片式回答、渐变色按钮、圆角设计 / UI overhaul: cards, gradients, rounded design
- 搜索引擎面板重设计：图标按钮、实时输入 / Search panel redesign
- 响应式布局 / Responsive layout

### v4.1.0
- 新增用户主页浏览助手 / Added profile browsing helper
- 新增验证码页友好提示 / Added captcha page prompt

### v4.0.0
- 新增回答浏览器（iframe + fxzhihu.com 切换）/ Added answer browser
- 新增多排序合并加载 / Added multi-sort merge loading
- 新增盐选内容折叠 / Added salt-select collapsing
- 新增链接重定向清理 / Added link redirect cleanup
- 新增 CSS 注入 document-start 阶段 / Added CSS injection at document-start

### v3.0.0
- 添加搜索功能 / Added search functionality

### v2.0.0
- 添加回答扩展（合并加载 + iframe 浏览）/ Added answer extension

### v1.0.0
- 基础弹窗移除和滚动恢复 / Basic modal removal and scroll restoration

---

## 许可证 / License

MIT License - 可自由使用、修改和分发 / Free to use, modify and distribute.
