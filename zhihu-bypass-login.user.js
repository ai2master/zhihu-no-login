// ==UserScript==
// @name         知乎免登录浏览增强版
// @name:en      Zhihu No-Login Browse Enhanced
// @namespace    zhihu-bypass-login-enhanced
// @version      4.2.1
// @description  绕过知乎登录限制：移除登录弹窗、解除回答浏览限制、恢复原生搜索、自动展开折叠内容、防跳转登录页、用户主页内容浏览助手
// @description:en  Bypass Zhihu login wall: remove modals, unlock answers, restore native search, auto-expand, prevent login redirects, profile page helper
// @author       Claude Code
// @match        *://*.zhihu.com/*
// @exclude      *://link.zhihu.com/*
// @grant        none
// @run-at       document-start
// @license      MIT
// @noframes     false
// ==/UserScript==

/**
 * ============================================================================
 * 知乎免登录浏览增强版 v4.2.1
 * Zhihu No-Login Browse Enhanced v4.2.1
 * ============================================================================
 *
 * 【脚本概述 / Script Overview】
 * 本脚本用于绕过知乎（zhihu.com）对未登录用户的各种限制，
 * 让你无需注册或登录即可正常浏览知乎内容。
 * This script bypasses various restrictions Zhihu imposes on
 * non-logged-in users, allowing normal browsing without registration or login.
 *
 * 【功能模块 / Feature Modules】
 * 1. 登录弹窗移除 / Login modal removal
 * 2. 滚动锁定解除 / Scroll lock removal
 * 3. 回答浏览扩展 / Extended answer viewing (merge multiple sort orders)
 * 4. 内置回答浏览器 / Built-in answer browser with iframe navigation
 * 5. 原生搜索恢复 + 外部搜索引擎备选 / Native search restoration + external engine fallback
 * 6. 自动展开折叠内容 / Auto-expand collapsed content
 * 7. 登录页跳转拦截 / Login redirect interception
 * 8. 用户主页浏览助手 / User profile browsing helper
 * 9. 盐选广告折叠 / Salt-select (paid content) ad collapsing
 * 10. 链接重定向清理 / Link redirect cleanup
 *
 * 【技术架构 / Technical Architecture】
 * 脚本分为 8 个主要部分，按执行时机排列：
 * The script is divided into 8 major parts, ordered by execution timing:
 *
 *   Part 1: document-start 阶段拦截 (fetch hook + initialData patch)
 *           document-start phase interception
 *   Part 2: 登录页跳转拦截 (history API hook + location redirect)
 *           Login redirect blocking
 *   Part 3: CSS 样式注入 (完整 UI 组件样式系统)
 *           CSS injection (complete UI component style system)
 *   Part 4: DOM 操作函数 (弹窗移除、滚动恢复、内容展开等)
 *           DOM manipulation functions (modal removal, scroll restore, etc.)
 *   Part 5: 回答扩展加载 (SSR 数据提取 + 多排序合并 + iframe 浏览器)
 *           Extended answer loading (SSR data + sort merging + iframe browser)
 *   Part 6: 搜索页面优化 (原生搜索检测 + 外部引擎备选面板)
 *           Search page optimization (native search detection + fallback panel)
 *   Part 7: 用户主页增强 (资料提取 + 搜索引擎入口)
 *           User profile enhancement (data extraction + search engine entries)
 *   Part 8: 主循环与初始化 (MutationObserver + 定时器 + 事件监听)
 *           Main loop & initialization (MutationObserver + timer + event listeners)
 *
 * 【性能优化 / Performance Optimizations】
 * - 浅层 DOM 扫描：fixed/sticky 弹窗检测只遍历 body 一级+二级子节点（~30 个），
 *   而非全部 div（~3000+ 个）
 *   Shallow DOM scan: fixed/sticky modal detection only traverses body's
 *   first and second level children (~30 elements) instead of all divs (~3000+)
 * - 200ms 时间戳节流：合并定时器/Observer/滚动触发的重复调用
 *   200ms timestamp throttle: deduplicates timer/Observer/scroll triggers
 * - per-element 标记：已处理的元素不会被重复扫描
 *   Per-element markers: processed elements won't be re-scanned
 *
 * 【已知限制 / Known Limitations】
 * - 知乎 API 需要 x-zse-96 加密签名，脚本无法调用 API 获取更多回答
 *   Zhihu API requires x-zse-96 encrypted signature, script cannot call API
 * - 用户主页限制为服务端不传输数据（2024 年 5 月起），只能通过搜索引擎间接访问
 *   Profile page restriction is server-side (since May 2024), only accessible via search engines
 * - 搜索需要 __zse_ck cookie（浏览器生成），首次可能无结果
 *   Search requires __zse_ck cookie (browser-generated), may fail on first visit
 * ============================================================================
 */

(function () {
    'use strict';

    /**
     * 单例守卫：防止脚本重复执行
     * Singleton guard: prevents duplicate script execution
     *
     * 在以下场景可能触发重复执行：
     * Duplicate execution may occur in these scenarios:
     * - 用户同时安装了多个知乎增强脚本 / Multiple Zhihu scripts installed
     * - Tampermonkey 在 iframe 中也注入了脚本 / Tampermonkey injects into iframes
     * - 页面 SPA 导航导致脚本重新执行 / SPA navigation triggers re-execution
     */
    if (window.__zhBypassEnhanced) return;
    window.__zhBypassEnhanced = true;

    /**
     * 日志前缀标签，所有 console.log 输出均带此前缀，方便在控制台中过滤
     * Log prefix tag, all console.log output carries this prefix for easy filtering
     */
    const TAG = '[知乎免登录]';

    // =====================================================================
    // 第一部分：document-start 阶段 — 在页面 JS 执行前完成拦截
    // Part 1: document-start Phase — Intercept before page JS execution
    // =====================================================================
    //
    // 【为什么需要在 document-start 执行？/ Why execute at document-start?】
    // 知乎的前端 JS 会在加载时检查登录状态，如果未登录就弹出登录窗口、
    // 锁定页面滚动。我们必须在知乎 JS 执行之前完成拦截，才能阻止这些行为。
    // Zhihu's frontend JS checks login status on load, showing login modals
    // and locking scroll if not logged in. We must intercept BEFORE their JS
    // runs to prevent these behaviors.

    /**
     * 1. Fetch API Hook（请求拦截器）
     *    Fetch API Hook (Request Interceptor)
     *
     * 【原理 / How it works】
     * 知乎前端通过 fetch() 调用 /feeds 和 /answers API 获取更多回答。
     * 未登录时这些 API 返回 403 + { error: { need_login: true } }，
     * 前端收到后会弹出登录窗口。
     * Zhihu's frontend calls /feeds and /answers APIs via fetch().
     * Without login, these return 403 + { error: { need_login: true } },
     * which triggers the login modal.
     *
     * 【拦截策略 / Interception strategy】
     * - 只拦截 /feeds 和 /answers 路径的 403 响应
     *   Only intercept 403 responses from /feeds and /answers paths
     * - 将 need_login 的 403 替换为 200 + 空数据，让前端以为"没有更多回答了"
     *   Replace need_login 403 with 200 + empty data, making frontend think "no more answers"
     * - 不拦截搜索 API（/search），让搜索走原生流程
     *   Don't intercept search API (/search), let search use native flow
     * - 错误码 40353 = need_login, 40362 = login_required
     *   Error code 40353 = need_login, 40362 = login_required
     */
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
        return originalFetch.apply(this, args).then(response => {
            // 提取请求 URL（支持 string 和 Request 对象两种调用方式）
            // Extract request URL (supports both string and Request object)
            const url = (typeof args[0] === 'string') ? args[0] : (args[0]?.url || '');

            // 只拦截回答/feed 相关的 403，不拦截搜索
            // Only intercept 403 from answer/feed endpoints, skip search
            if (response.status === 403 && (url.includes('/feeds') || url.includes('/answers'))) {
                return response.clone().text().then(text => {
                    try {
                        const data = JSON.parse(text);
                        // 检查是否为"需要登录"错误
                        // Check if it's a "need login" error
                        if (data?.error?.need_login || data?.error?.code === 40353 || data?.error?.code === 40362) {
                            console.log(TAG, '拦截 403 need_login:', url.substring(0, 80));
                            // 返回伪造的空数据响应，告诉前端"已经没有更多数据了"
                            // Return fake empty response, telling frontend "no more data"
                            return new Response(JSON.stringify({ data: [], paging: { is_end: true, next: '' } }), {
                                status: 200, headers: { 'Content-Type': 'application/json' }
                            });
                        }
                    } catch (_) { /* JSON 解析失败则不拦截 / Skip if JSON parse fails */ }
                    return response;
                }).catch(() => response);
            }
            return response;
        });
    };

    /**
     * 2. 初始化数据补丁（SSR 数据修改）
     *    Initial Data Patch (SSR Data Modification)
     *
     * 【原理 / How it works】
     * 知乎使用服务端渲染（SSR），页面 HTML 中包含一个 <script id="js-initialData">
     * 标签，内含 JSON 格式的页面初始数据。其中两个关键字段控制登录限制：
     * Zhihu uses SSR, the HTML contains a <script id="js-initialData"> tag
     * with JSON initial data. Two key fields control login restrictions:
     *
     * - needForceLogin: true → 前端会强制弹出登录窗口
     *   needForceLogin: true → frontend forces login modal
     * - isDrained: true → 前端认为"回答已加载完毕"，不会请求更多
     *   isDrained: true → frontend thinks "all answers loaded", won't fetch more
     *
     * 我们在 JS 读取这些数据之前将它们改为 false。
     * We modify them to false before JS reads the data.
     */
    function patchInitialData() {
        const el = document.getElementById('js-initialData');
        if (!el) return false;
        try {
            const d = JSON.parse(el.textContent);
            let changed = false;

            // 遍历所有问题的回答配置，清除登录限制标志
            // Iterate all question answer configs, clear login restriction flags
            const qAnswers = d?.initialState?.question?.answers;
            if (qAnswers) {
                for (const qid in qAnswers) {
                    if (qAnswers[qid].needForceLogin) { qAnswers[qid].needForceLogin = false; changed = true; }
                    if (qAnswers[qid].isDrained) { qAnswers[qid].isDrained = false; changed = true; }
                }
            }

            // 将修改后的 JSON 写回 DOM，让知乎前端 JS 读取到修改后的值
            // Write modified JSON back to DOM, so Zhihu's JS reads the patched values
            if (changed) {
                el.textContent = JSON.stringify(d);
                console.log(TAG, '已 patch initialData (needForceLogin / isDrained)');
            }
            return changed;
        } catch (_) { return false; }
    }

    /**
     * 早期 MutationObserver：监控 js-initialData 标签的插入时机
     * Early MutationObserver: watch for js-initialData tag insertion
     *
     * 由于 @run-at document-start 时 DOM 还没建好，我们用 MutationObserver
     * 监控 DOM 变化，一旦发现 js-initialData 被插入就立即 patch。
     * Since DOM isn't ready at document-start, we use MutationObserver to
     * watch DOM changes and patch js-initialData as soon as it's inserted.
     */
    const earlyObs = new MutationObserver(muts => {
        for (const m of muts) for (const n of m.addedNodes) {
            if (n.id === 'js-initialData' || (n.querySelector && n.querySelector('#js-initialData'))) {
                patchInitialData();
                earlyObs.disconnect(); // patch 完成后立即断开，节省资源 / Disconnect after patch to save resources
                return;
            }
        }
    });
    earlyObs.observe(document.documentElement, { childList: true, subtree: true });

    // =====================================================================
    // 第二部分：防止跳转到登录页
    // Part 2: Prevent Redirect to Login Page
    // =====================================================================
    //
    // 【背景 / Background】
    // 知乎在多种场景下会将未登录用户重定向到 /signin 或 /login 页面：
    // Zhihu redirects non-logged-in users to /signin or /login in many scenarios:
    // - 点击关注按钮 / Clicking follow button
    // - 点击赞同按钮 / Clicking upvote button
    // - 某些操作触发的 JS 跳转 / JS redirects triggered by certain actions
    // - 直接访问需要登录的页面 / Directly visiting login-required pages

    (function blockLoginRedirect() {
        /**
         * History API Hook：拦截 pushState / replaceState 中的登录页跳转
         * History API Hook: intercept login page navigation in pushState/replaceState
         *
         * 知乎使用 SPA（单页应用），页面跳转通过 history.pushState 实现。
         * 我们 hook 这两个方法，如果目标 URL 包含 /signin 或 /login 则静默丢弃。
         * Zhihu uses SPA, navigation is via history.pushState.
         * We hook both methods, silently discarding URLs containing /signin or /login.
         */
        const wrapHistory = (orig) => function (...a) {
            const u = String(a[2] || '');
            if (u.includes('/signin') || u.includes('/login')) {
                console.log(TAG, '阻止 history 跳转到登录页:', u);
                return; // 静默丢弃跳转 / Silently discard navigation
            }
            return orig.apply(this, a);
        };
        history.pushState = wrapHistory(history.pushState);
        history.replaceState = wrapHistory(history.replaceState);

        /**
         * 已在登录页时的处理：自动跳回有意义的页面
         * Handle case where user is already on login page: redirect back
         *
         * 优先跳回来源页（referrer），如果没有则跳到知乎热榜
         * Prefer redirecting to referrer, fallback to Zhihu Hot list
         */
        const href = window.location.href;
        if (href.includes('/signin') || href.includes('/login')) {
            const ref = document.referrer || '';
            if (ref && ref.includes('zhihu.com') && !ref.includes('/signin') && !ref.includes('/login')) {
                window.location.replace(ref); // 跳回来源页 / Redirect to referrer
            } else {
                window.location.replace('https://www.zhihu.com/hot'); // 默认跳到热榜 / Default to Hot list
            }
        }
    })();

    // =====================================================================
    // 第三部分：CSS 注入 — 完整的样式系统
    // Part 3: CSS Injection — Complete Style System
    // =====================================================================
    //
    // 【设计说明 / Design Notes】
    // 本脚本注入一套完整的 CSS 样式系统，用于：
    // This script injects a complete CSS style system for:
    // - 隐藏登录弹窗 / Hiding login modals
    // - 回答卡片 UI / Answer card UI
    // - 按钮系统（主按钮/导航按钮/引擎按钮）/ Button system (primary/nav/engine)
    // - 回答编号药丸 / Answer number pills
    // - Toggle 开关 / Toggle switches
    // - 输入框、iframe、信息框 / Input, iframe, info boxes
    // - 文字排版 / Typography
    // - 响应式布局 / Responsive layout
    //
    // 所有类名均以 zhBypass- 为前缀，避免与知乎原有样式冲突。
    // All class names are prefixed with zhBypass- to avoid conflicts with Zhihu's styles.
    //
    // 设计风格跟随知乎原生 UI：白底、圆角、蓝色主色调（#0066ff）。
    // Design follows Zhihu's native UI: white background, rounded corners, blue accent (#0066ff).

    /**
     * 注入全局 CSS 样式表
     * Inject global CSS stylesheet
     *
     * 使用 ID 检查防止重复注入（SPA 导航时可能多次调用）
     * Uses ID check to prevent duplicate injection (may be called multiple times in SPA)
     */
    function injectCSS() {
        if (document.getElementById('zhBypass-styles')) return;
        const style = document.createElement('style');
        style.id = 'zhBypass-styles';
        style.textContent = `
/* === 登录弹窗隐藏 / Login modal hiding === */
.signFlowModal { display: none !important; }
.Modal-backdrop { display: none !important; }

/* === 基础设计令牌 / Base design tokens === */
.zhBypass-panel {
    font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(26, 26, 26, 0.1);
    padding: 20px 24px;
    margin: 16px 0;
    color: #1a1a1a;
    line-height: 1.6;
}

/* === 回答卡片 / Answer card === */
.zhBypass-card {
    padding: 18px 20px;
    background: #fff;
    border: 1px solid #f0f2f7;
    border-radius: 10px;
    margin: 10px 0;
    transition: box-shadow 0.25s ease, border-color 0.25s ease;
}
.zhBypass-card:hover {
    box-shadow: 0 4px 12px rgba(26, 26, 26, 0.08);
    border-color: #e4e6eb;
}
.zhBypass-card-author {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
}
.zhBypass-card-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, #0066ff 0%, #1a8cff 100%);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    flex-shrink: 0;
}
.zhBypass-card-authorName {
    font-size: 15px;
    font-weight: 600;
    color: #1a1a1a;
}
.zhBypass-card-headline {
    color: #8590a6;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 300px;
}
.zhBypass-card-content {
    font-size: 15px;
    line-height: 1.8;
    color: #1a1a1a;
    word-break: break-word;
    max-height: 400px;
    overflow-y: auto;
}
.zhBypass-card-content img {
    max-width: 100%;
    border-radius: 6px;
    margin: 8px 0;
}
.zhBypass-card-meta {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid #f6f6f6;
    color: #8590a6;
    font-size: 13px;
}
.zhBypass-card-meta svg {
    vertical-align: -2px;
    margin-right: 4px;
}
.zhBypass-card-meta a {
    color: #0066ff;
    text-decoration: none;
    margin-left: auto;
    font-size: 13px;
    transition: color 0.2s;
}
.zhBypass-card-meta a:hover {
    color: #0052cc;
    text-decoration: underline;
}

/* === 按钮系统 / Button system === */
.zhBypass-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 28px;
    border: none;
    border-radius: 20px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.25s ease;
    outline: none;
    font-family: inherit;
    line-height: 1.4;
}
.zhBypass-btn:active {
    transform: scale(0.97);
}
.zhBypass-btn-primary {
    background: linear-gradient(135deg, #0066ff 0%, #1a8cff 100%);
    color: #fff;
    box-shadow: 0 2px 8px rgba(0, 102, 255, 0.25);
}
.zhBypass-btn-primary:hover {
    box-shadow: 0 4px 14px rgba(0, 102, 255, 0.35);
    background: linear-gradient(135deg, #0052cc 0%, #0066ff 100%);
}
.zhBypass-btn-primary:disabled {
    background: #a0c4ff;
    box-shadow: none;
    cursor: default;
    transform: none;
}
.zhBypass-btn-success {
    background: linear-gradient(135deg, #07c160 0%, #2bd974 100%) !important;
    box-shadow: 0 2px 8px rgba(7, 193, 96, 0.25) !important;
}
.zhBypass-btn-warning {
    background: linear-gradient(135deg, #ff9500 0%, #ffb340 100%) !important;
    box-shadow: 0 2px 8px rgba(255, 149, 0, 0.25) !important;
}

/* === 导航按钮（上一条/下一条）/ Navigation buttons (prev/next) === */
.zhBypass-navBtn {
    padding: 7px 20px;
    border: 1px solid #ebebeb;
    border-radius: 20px;
    cursor: pointer;
    background: #fff;
    color: #646464;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s ease;
    outline: none;
    font-family: inherit;
}
.zhBypass-navBtn:hover:not(:disabled) {
    border-color: #0066ff;
    color: #0066ff;
    background: #f0f7ff;
}
.zhBypass-navBtn:active:not(:disabled) {
    transform: scale(0.97);
}
.zhBypass-navBtn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
}

/* === 回答编号药丸 / Answer number pills === */
.zhBypass-pill {
    display: inline-block;
    padding: 4px 14px;
    background: #f6f6f6;
    border-radius: 14px;
    font-size: 12px;
    text-decoration: none;
    color: #646464;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
    line-height: 1.4;
}
.zhBypass-pill:hover {
    background: #ebebeb;
    color: #1a1a1a;
}
.zhBypass-pill--active {
    background: #0066ff !important;
    color: #fff !important;
    border-color: #0066ff !important;
    box-shadow: 0 2px 6px rgba(0, 102, 255, 0.2);
}

/* === 搜索引擎按钮 / Search engine buttons === */
.zhBypass-engineBtn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 14px;
    background: #fff;
    border: 1px solid #ebebeb;
    border-radius: 10px;
    text-decoration: none;
    color: #1a1a1a;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.25s ease;
}
.zhBypass-engineBtn:hover {
    border-color: #0066ff;
    background: #f0f7ff;
    box-shadow: 0 2px 8px rgba(0, 102, 255, 0.08);
    text-decoration: none;
    color: #1a1a1a;
}
.zhBypass-engineBtn:active {
    transform: scale(0.98);
}
.zhBypass-engineIcon {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 13px;
    color: #fff;
    flex-shrink: 0;
}

/* === Toggle 开关 / Toggle switch === */
.zhBypass-switch {
    position: relative;
    width: 38px;
    height: 20px;
    -webkit-appearance: none;
    appearance: none;
    background: #dcdfe6;
    border-radius: 10px;
    outline: none;
    cursor: pointer;
    transition: background 0.25s ease;
    border: none;
    flex-shrink: 0;
}
.zhBypass-switch:checked {
    background: #0066ff;
}
.zhBypass-switch::before {
    content: '';
    position: absolute;
    left: 2px;
    top: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    transition: left 0.25s ease;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
}
.zhBypass-switch:checked::before {
    left: 20px;
}

/* === Toggle 标签 / Toggle label === */
.zhBypass-toggleLabel {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 13px;
    color: #8590a6;
    user-select: none;
}
.zhBypass-toggleLabel:hover {
    color: #646464;
}

/* === 输入框 / Input field === */
.zhBypass-input {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid #ebebeb;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    color: #1a1a1a;
    background: #fff;
    font-family: inherit;
}
.zhBypass-input:focus {
    border-color: #0066ff;
    box-shadow: 0 0 0 3px rgba(0, 102, 255, 0.1);
}
.zhBypass-input::placeholder {
    color: #c2c8d1;
}

/* === iframe 容器 / iframe container === */
.zhBypass-iframe {
    width: 100%;
    height: 600px;
    border: 1px solid #ebebeb;
    border-radius: 10px;
}

/* === 信息框 / Info box === */
.zhBypass-infoBox {
    background: #f6f6f6;
    border-radius: 10px;
    padding: 16px 20px;
}

/* === 警告框（验证页）/ Warning box (captcha page) === */
.zhBypass-warningBox {
    max-width: 600px;
    margin: 24px auto;
    padding: 20px 24px;
    background: linear-gradient(135deg, #fffef5 0%, #fffbe6 100%);
    border: 1px solid #ffe58f;
    border-radius: 12px;
    text-align: center;
}

/* === 文字排版 / Typography === */
.zhBypass-heading {
    font-size: 16px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 8px;
    line-height: 1.4;
}
.zhBypass-subheading {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 8px;
}
.zhBypass-subtext {
    color: #8590a6;
    font-size: 14px;
    line-height: 1.7;
}
.zhBypass-hint {
    color: #999;
    font-size: 12px;
    line-height: 1.7;
}

/* === 布局 / Layout === */
.zhBypass-grid-4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
}
.zhBypass-grid-2 {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
}
.zhBypass-flexCenter {
    display: flex;
    align-items: center;
    justify-content: center;
}
.zhBypass-flexBetween {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.zhBypass-idList {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-height: 200px;
    overflow-y: auto;
    padding: 6px 0;
}
.zhBypass-divider {
    border-top: 1px solid #f0f2f7;
    margin-top: 18px;
    padding-top: 18px;
}

/* === 标签 / Tags === */
.zhBypass-tag {
    display: inline-block;
    padding: 2px 8px;
    background: #f0f2f7;
    border-radius: 4px;
    font-size: 12px;
    color: #8590a6;
}
.zhBypass-tag--blue {
    background: #f0f7ff;
    color: #0066ff;
}

/* === code 样式 / Code style === */
.zhBypass-panel code {
    padding: 2px 6px;
    background: #f0f2f7;
    border-radius: 4px;
    font-size: 12px;
    font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
    color: #e83e8c;
}

/* === 链接通用 / Link common === */
.zhBypass-link {
    color: #0066ff;
    text-decoration: none;
    transition: color 0.2s;
}
.zhBypass-link:hover {
    color: #0052cc;
    text-decoration: underline;
}

/* === 浏览器导航栏 / Browser navigation bar === */
.zhBypass-browserNav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    padding: 8px 0;
}
.zhBypass-browserNav-info {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #8590a6;
    font-size: 13px;
}
.zhBypass-browserNav-info a {
    color: #0066ff;
    text-decoration: none;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 4px;
    background: #f0f7ff;
    transition: all 0.2s;
}
.zhBypass-browserNav-info a:hover {
    background: #dbeaff;
}

/* === 计数徽章 / Count badge === */
.zhBypass-countBadge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: #f0f2f7;
    color: #646464;
    font-size: 12px;
    font-weight: 600;
}

/* === 响应式 / Responsive === */
@media (max-width: 600px) {
    .zhBypass-grid-4 { grid-template-columns: repeat(2, 1fr); }
    .zhBypass-panel { padding: 16px; margin: 10px 0; }
    .zhBypass-btn { padding: 8px 20px; font-size: 13px; }
}
`;
        const target = document.head || document.documentElement;
        target.appendChild(style);
    }
    injectCSS();

    // =====================================================================
    // 第四部分：DOMContentLoaded 后的 UI 处理
    // Part 4: Post-DOMContentLoaded UI Processing
    // =====================================================================
    //
    // 本部分包含所有需要在 DOM 就绪后执行的核心函数：
    // This part contains all core functions that run after DOM is ready:
    // - removeLoginModal()  — 移除各类登录弹窗 / Remove various login modals
    // - restoreScroll()     — 恢复被锁定的页面滚动 / Restore locked page scroll
    // - watchOverflow()     — 持续监控 overflow 属性 / Continuously monitor overflow
    // - expandContent()     — 展开被截断的回答内容 / Expand truncated answer content
    // - removeRedirects()   — 清理外部链接重定向 / Clean external link redirects
    // - collapseSaltContent() — 折叠盐选付费广告 / Collapse salt-select paid ads

    /**
     * DOM 就绪检查工具函数
     * DOM readiness check utility
     *
     * 如果 DOM 还在加载中，注册 DOMContentLoaded 事件；否则直接执行。
     * If DOM is still loading, register DOMContentLoaded listener; otherwise execute immediately.
     */
    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    /**
     * 移除登录弹窗（核心函数）
     * Remove Login Modal (Core Function)
     *
     * 知乎使用多种方式显示登录提示，本函数分 5 步逐一处理：
     * Zhihu uses multiple methods to show login prompts, this function handles them in 5 steps:
     *
     * Step 1: 精确类名匹配 — .signFlowModal（知乎登录流程弹窗）
     *         Exact class match — .signFlowModal (Zhihu login flow modal)
     * Step 2: 模糊内容匹配 — .Modal-wrapper 内含登录相关文案
     *         Fuzzy content match — .Modal-wrapper containing login-related text
     * Step 3: 浅层 DOM 扫描 — fixed/sticky 定位的登录提示框
     *         Shallow DOM scan — fixed/sticky positioned login prompt boxes
     * Step 4: 浅层 DOM 扫描 — 含"登录"按钮的 fixed 小浮窗
     *         Shallow DOM scan — fixed floating widgets with "login" buttons
     * Step 5: 全量 div 扫描 — 内嵌"登录知乎，您可以享受以下权益"面板
     *         Full div scan — inline "login to enjoy benefits" panels
     *
     * 【性能优化说明 / Performance optimization notes】
     * Steps 3-4 使用浅层 DOM 扫描（body 子节点 + 一级孙节点），约 30 个元素，
     * 而非遍历所有 div（约 3000-5000 个）。fixed/sticky 元素在 CSS 规范中
     * 必须位于 DOM 较浅层才能正确渲染，因此浅层扫描不会遗漏。
     * Steps 3-4 use shallow DOM scan (body children + grandchildren), ~30 elements,
     * instead of all divs (~3000-5000). Fixed/sticky elements must be in shallow DOM
     * per CSS spec for correct rendering, so shallow scan won't miss them.
     *
     * Step 5 保留全量 div 扫描，但使用两级过滤：
     * Step 5 keeps full div scan but with two-level filtering:
     * - children.length 预过滤：跳过子节点数 <= 2 或 >= 15 的元素（排除 95% 的 div）
     *   children.length pre-filter: skip elements with <= 2 or >= 15 children (eliminates 95%)
     * - _zhBypHidden 标记：已处理的元素不会被重复检查
     *   _zhBypHidden marker: processed elements won't be re-checked
     *
     * @returns {boolean} 是否移除了至少一个元素 / Whether at least one element was removed
     */
    function removeLoginModal() {
        let removed = false;

        // Step 1: 精确匹配知乎登录弹窗类名 .signFlowModal
        // Step 1: Exact match Zhihu login modal class .signFlowModal
        // 这是知乎最常用的登录弹窗组件，优先移除其外层 .Modal-wrapper
        // This is Zhihu's most common login modal component, prioritize removing its wrapper
        document.querySelectorAll('.signFlowModal').forEach(e => {
            const wrapper = e.closest('.Modal-wrapper');
            if (wrapper) { wrapper.remove(); removed = true; }
            else { e.remove(); removed = true; }
        });

        // Step 2: 模糊匹配 — 移除包含登录/注册相关文案的 Modal-wrapper
        // Step 2: Fuzzy match — remove Modal-wrappers containing login/register text
        // 覆盖知乎可能使用的其他弹窗变体（如密码重置、扫码登录等）
        // Covers other modal variants Zhihu may use (password reset, QR code login, etc.)
        document.querySelectorAll('.Modal-wrapper').forEach(e => {
            const t = e.textContent || '';
            if (t.includes('登录') || t.includes('注册') || t.includes('密码') || t.includes('扫码')) {
                e.remove();
                removed = true;
            }
        });

        // Step 3-4: 浅层 DOM 扫描 — 收集 body 直接子节点 + 一级孙节点中的 div
        // Step 3-4: Shallow DOM scan — collect divs from body's direct children + grandchildren
        // 【为什么不遍历所有 div？/ Why not iterate all divs?】
        // 典型知乎页面有 3000-5000 个 div，但 fixed/sticky 弹窗只会出现在 DOM 浅层。
        // 浅层扫描约 30 个元素，性能提升 100 倍以上。
        // A typical Zhihu page has 3000-5000 divs, but fixed/sticky popups only appear
        // in shallow DOM. Shallow scan checks ~30 elements, 100x+ faster.
        const shallowDivs = [];
        for (const child of document.body.children) {
            if (child.tagName === 'DIV') {
                shallowDivs.push(child);
                for (const gc of child.children) {
                    if (gc.tagName === 'DIV') shallowDivs.push(gc);
                }
            }
        }
        for (const e of shallowDivs) {
            const childCount = e.children.length;
            if (childCount >= 15) continue; // 子元素太多不可能是小型弹窗 / Too many children, not a small popup
            const t = e.textContent || '';

            // Step 3: 右下角 fixed/sticky 登录提示框（"登录即可查看" / "立即登录/注册"）
            // Step 3: Bottom-right fixed/sticky login prompt ("Login to view" / "Login/Register now")
            if ((t.includes('登录即可查看') || t.includes('立即登录/注册')) && childCount < 10) {
                try {
                    const s = window.getComputedStyle(e);
                    if (s.position === 'fixed' || s.position === 'sticky') {
                        e.remove(); removed = true; continue;
                    }
                } catch (_) {}
            }

            // Step 4: 含"登录"按钮的 fixed 小浮窗（通常在页面底部 bottom < 200px）
            // Step 4: Fixed floating widget with "login" button (usually at bottom < 200px)
            if (childCount <= 10) {
                const btn = e.querySelector('button');
                if (btn && btn.textContent && btn.textContent.includes('登录')) {
                    try {
                        const s = window.getComputedStyle(e);
                        if (s.position === 'fixed' && parseInt(s.bottom, 10) < 200) {
                            e.style.display = 'none'; removed = true; continue;
                        }
                    } catch (_) {}
                }
            }
        }

        // Step 5: 内嵌登录推荐面板（"登录知乎，您可以享受以下权益"）
        // Step 5: Inline login promotion panel ("Login to enjoy benefits")
        // 这类面板嵌入在正文区域，不是 fixed 定位，需要全量扫描
        // These panels are embedded in content area, not fixed, requiring full scan
        // 使用 children.length 预过滤 + _zhBypHidden 标记避免重复处理
        // Uses children.length pre-filter + _zhBypHidden marker to avoid reprocessing
        document.querySelectorAll('div').forEach(e => {
            if (e._zhBypHidden) return; // 已处理过的跳过 / Skip already processed
            const childCount = e.children.length;
            if (childCount <= 2 || childCount >= 15) return; // 快速排除大部分 div / Quick-exclude most divs
            if ((e.textContent || '').includes('登录知乎，您可以享受以下权益')) {
                e.style.display = 'none';
                e._zhBypHidden = true; // 标记为已处理 / Mark as processed
                removed = true;
            }
        });

        if (removed) {
            console.log(TAG, '已移除登录弹窗');
        }
        return removed;
    }

    /**
     * 恢复页面滚动
     * Restore Page Scroll
     *
     * 知乎弹出登录窗口时会设置 overflow: hidden 和 padding-right（防止抖动），
     * 导致页面无法滚动。本函数清除这些样式，恢复正常滚动。
     * When Zhihu shows login modal, it sets overflow: hidden and padding-right
     * (to prevent jitter), locking the page. This function clears these styles.
     */
    function restoreScroll() {
        if (document.documentElement.style.overflow === 'hidden') {
            document.documentElement.style.overflow = '';
        }
        if (document.body && document.body.style.overflow === 'hidden') {
            document.body.style.overflow = '';
        }
        if (document.body) {
            document.body.style.paddingRight = '';
        }
    }

    /**
     * 持续监控 <html> 元素的 overflow 属性变化
     * Continuously Monitor <html> Element's overflow Attribute Changes
     *
     * 即使移除了弹窗，知乎的 JS 可能随后再次设置 overflow: hidden。
     * 用 MutationObserver 监控 style 属性变化，一旦发现 overflow: hidden 立即清除。
     * Even after removing modals, Zhihu's JS may re-set overflow: hidden.
     * Uses MutationObserver to watch style changes, clearing overflow: hidden immediately.
     */
    function watchOverflow() {
        const htmlObs = new MutationObserver(muts => {
            for (const m of muts) {
                if (m.type === 'attributes' && m.attributeName === 'style') {
                    if (document.documentElement.style.overflow === 'hidden') {
                        document.documentElement.style.overflow = '';
                    }
                }
            }
        });
        // 只监控 style 属性变化，不监控子节点，最小化性能开销
        // Only watch style attribute changes, not children, minimizing overhead
        htmlObs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    }

    /**
     * 展开被截断的回答内容
     * Expand Truncated Answer Content
     *
     * 知乎对未登录用户截断回答内容（设置 max-height + overflow: hidden），
     * 并显示"阅读全文"按钮。本函数：
     * Zhihu truncates answers for non-logged-in users (max-height + overflow: hidden),
     * showing a "Read full text" button. This function:
     * 1. 移除 RichContent-inner 的 max-height 和 overflow 限制
     *    Removes max-height and overflow restrictions on RichContent-inner
     * 2. 自动点击"阅读全文"/"展开阅读全文"按钮
     *    Auto-clicks "Read full text" / "Expand full text" buttons
     */
    function expandContent() {
        // 移除内容区域的高度限制
        // Remove height restrictions on content areas
        document.querySelectorAll('[class*="RichContent-inner"]').forEach(e => {
            if (e.style.maxHeight || e.style.overflow === 'hidden') {
                e.style.maxHeight = 'none';
                e.style.overflow = 'visible';
            }
        });
        // 自动点击展开按钮
        // Auto-click expand buttons
        document.querySelectorAll('[class*="RichContent"] button, .ContentItem button').forEach(b => {
            const t = b.textContent.trim();
            if (t === '阅读全文' || t === '展开阅读全文') b.click();
        });
    }

    /**
     * 移除外部链接重定向
     * Remove External Link Redirects
     *
     * 知乎将所有外部链接改为 link.zhihu.com/?target=URL 格式，
     * 经过知乎服务器中转。本函数解析 target 参数，恢复原始 URL。
     * Zhihu rewrites all external links to link.zhihu.com/?target=URL format,
     * routing through Zhihu's server. This function parses the target param,
     * restoring original URLs.
     *
     * @param {Element} [root] - 搜索的根元素，默认为 document / Root element to search, defaults to document
     */
    function removeRedirects(root) {
        (root || document).querySelectorAll('a[href*="link.zhihu.com"]').forEach(link => {
            const match = /link\.zhihu\.com\/\?target=(.+)$/.exec(link.href);
            if (match) {
                try { link.href = decodeURIComponent(match[1]); } catch (_) {}
            }
        });
    }

    /**
     * 折叠盐选（付费）内容
     * Collapse Salt-Select (Paid) Content
     *
     * 知乎"盐选"是付费内容，通常作为回答列表中的广告展示，
     * 带有 .KfeCollection-AnswerTopCard-Container 标识。
     * 本函数检测盐选内容并自动点击折叠按钮，减少对正常浏览的干扰。
     * Zhihu "Salt Select" is paid content, usually shown as ads in answer lists,
     * identified by .KfeCollection-AnswerTopCard-Container class.
     * This function detects salt-select content and auto-clicks the collapse button.
     *
     * @param {Element} node - 新插入的 DOM 节点 / Newly inserted DOM node
     */
    function collapseSaltContent(node) {
        if (node && node.matches && node.matches('.List-item') && node.querySelector('.KfeCollection-AnswerTopCard-Container')) {
            const collapseBtn = node.querySelector('.RichContent-collapsedText');
            if (collapseBtn) collapseBtn.click();
        }
    }

    // =====================================================================
    // 第五部分：扩展回答查看功能
    // Part 5: Extended Answer Viewing
    // =====================================================================
    //
    // 【问题背景 / Problem background】
    // 知乎对未登录用户只显示 3 条回答（SSR 返回的），且 API 被 x-zse-96
    // 加密签名保护无法直接调用。
    // Zhihu only shows 3 answers to non-logged-in users (from SSR), and the API
    // is protected by x-zse-96 encrypted signature, preventing direct API calls.
    //
    // 【解决方案 / Solution】
    // 利用知乎支持 ?sortby=default 和 ?sortby=updated 两种排序的特点，
    // 分别请求两种排序的 SSR 页面，提取各自返回的 3 条回答，合并去重后
    // 最多可获得约 6 条回答。
    // Exploit Zhihu's support for ?sortby=default and ?sortby=updated,
    // request both SSR pages, extract 3 answers from each, merge and deduplicate
    // to get up to ~6 answers.
    //
    // 同时提供 iframe 浏览器，让用户可以逐条浏览每个回答的完整页面。
    // Also provides an iframe browser for viewing each answer's full page.

    /**
     * 从 js-initialData 中提取当前页面已有的回答 ID
     * Extract existing answer IDs from js-initialData
     *
     * 检查两个数据源：
     * Checks two data sources:
     * 1. initialState.entities.answers — 回答实体表 / Answer entity table
     * 2. initialState.question.answers[qid].ids — 回答 ID 列表 / Answer ID list
     *
     * @returns {Set<string>} 当前页面已有的回答 ID 集合 / Set of existing answer IDs
     */
    function extractCurrentAnswerIds() {
        const ids = new Set();
        try {
            const raw = document.getElementById('js-initialData')?.textContent;
            if (!raw) return ids;
            const d = JSON.parse(raw);

            const answers = d?.initialState?.entities?.answers || {};
            Object.keys(answers).forEach(id => ids.add(id));

            const qAnswers = d?.initialState?.question?.answers || {};
            for (const qid in qAnswers) {
                const idsList = qAnswers[qid]?.ids || [];
                idsList.forEach(item => {
                    const target = item?.target || item;
                    if (target && typeof target === 'string') ids.add(target);
                });
            }
        } catch (_) {}
        return ids;
    }

    /**
     * 通过 SSR 页面获取不同排序的回答
     * Fetch answers from different sort orders via SSR pages
     *
     * 【工作原理 / How it works】
     * 请求 /question/{qid}/answers/{sort} 页面的 HTML，
     * 从中提取 js-initialData 里的回答数据。使用原始 fetch（未被 hook 的）
     * 以 credentials: include 发送请求，携带已有的 cookie。
     * Requests the HTML of /question/{qid}/answers/{sort} page,
     * extracts answer data from js-initialData. Uses the original fetch
     * (not hooked) with credentials: include to send existing cookies.
     *
     * @param {string} questionId - 问题 ID / Question ID
     * @param {string} sort - 排序方式: 'default'(默认排序) 或 'updated'(时间排序)
     *                        Sort method: 'default' or 'updated' (by time)
     * @returns {Object} 回答对象映射 { answerId: answerData } / Answer map
     */
    async function fetchSortedAnswers(questionId, sort) {
        try {
            const url = sort
                ? `https://www.zhihu.com/question/${questionId}/answers/${sort}`
                : `https://www.zhihu.com/question/${questionId}`;
            const resp = await originalFetch(url, { credentials: 'include' });
            if (!resp.ok) return {};
            const html = await resp.text();
            const m = html.match(/id="js-initialData"[^>]*>(.+?)<\/script>/);
            if (!m) return {};
            const d = JSON.parse(m[1]);
            return d?.initialState?.entities?.answers || {};
        } catch (_) { return {}; }
    }

    /**
     * HTML 特殊字符转义
     * HTML Special Character Escaping
     *
     * 防止 XSS：用户名、签名等字段可能包含 HTML 特殊字符，
     * 写入 innerHTML 前必须转义。
     * Prevents XSS: username, headline etc. may contain HTML special chars,
     * must be escaped before writing to innerHTML.
     */
    const _escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function escapeHTML(str) {
        return str.replace(/[&<>"']/g, c => _escapeMap[c]);
    }

    /**
     * 渲染回答卡片
     * Render Answer Card
     *
     * 将单条回答数据渲染为卡片形式，包含：
     * Renders a single answer as a card, containing:
     * - 作者头像（首字母）+ 姓名 + 一句话简介 / Author avatar (initial) + name + headline
     * - 回答内容（HTML，已过滤 script 标签）/ Answer content (HTML, scripts filtered)
     * - 底部元信息：赞同数、评论数、发布时间、查看原文链接
     *   Bottom meta: upvotes, comments, created time, view original link
     *
     * @param {Element} container - 卡片容器 / Card container element
     * @param {string} qid - 问题 ID / Question ID
     * @param {string} aid - 回答 ID / Answer ID
     * @param {Object} answer - 回答数据对象 / Answer data object
     */
    function renderAnswerCard(container, qid, aid, answer) {
        const authorName = escapeHTML(answer.author?.name || answer.authorName || '匿名用户');
        const headline = escapeHTML(answer.author?.headline || '');
        const rawContent = answer.content || answer.excerpt || '';
        const content = rawContent.replace(/<script[\s\S]*?<\/script>/gi, '');
        const voteup = answer.voteupCount || 0;
        const commentCount = answer.commentCount || 0;
        const created = answer.createdTime ? new Date(answer.createdTime * 1000).toLocaleString('zh-CN') : '';
        const initial = authorName.charAt(0);

        const card = document.createElement('div');
        card.className = 'zhBypass-card';
        card.innerHTML = `
            <div class="zhBypass-card-author">
                <div class="zhBypass-card-avatar">${escapeHTML(initial)}</div>
                <div>
                    <div class="zhBypass-card-authorName">${authorName}</div>
                    ${headline ? `<div class="zhBypass-card-headline">${headline}</div>` : ''}
                </div>
            </div>
            <div class="zhBypass-card-content">${content}</div>
            <div class="zhBypass-card-meta">
                <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>${voteup} 赞同</span>
                <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>${commentCount} 评论</span>
                ${created ? `<span>${created}</span>` : ''}
                <a href="https://www.zhihu.com/question/${qid}/answer/${aid}" target="_blank">查看原文 &rarr;</a>
            </div>
        `;
        container.appendChild(card);
    }

    /**
     * 替换"查看剩余回答"按钮
     * Replace "View All Answers" Button
     *
     * 知乎在回答列表底部显示"查看全部 N 个回答"按钮，点击后要求登录。
     * 本函数将该按钮替换为自定义面板，提供：
     * Zhihu shows "View all N answers" button at bottom, which requires login.
     * This function replaces it with a custom panel providing:
     *
     * 1. "加载更多回答"按钮 — 点击后从两种排序的 SSR 页面合并新回答
     *    "Load more answers" button — merges answers from two sort orders
     * 2. 回答卡片展示 — 将新加载的回答渲染为卡片
     *    Answer card display — renders newly loaded answers as cards
     * 3. iframe 回答浏览器 — 逐条浏览所有回答的完整页面
     *    iframe answer browser — browse each answer's full page one by one
     * 4. fxzhihu.com 切换开关 — 可选使用第三方代理查看（无登录限制）
     *    fxzhihu.com toggle — optionally use third-party proxy (no login wall)
     *
     * 使用 _zhBypassPatched 标记防止重复处理同一个按钮。
     * Uses _zhBypassPatched marker to prevent processing the same button twice.
     */
    function patchViewAllButton() {
        if (window.location.pathname.includes('/answer/')) return;

        document.querySelectorAll('.ViewAll').forEach(el => {
            if (el._zhBypassPatched) return;
            el._zhBypassPatched = true;

            const qMatch = window.location.pathname.match(/\/question\/(\d+)/);
            if (!qMatch) return;
            const qid = qMatch[1];
            const origText = el.textContent.trim();

            el.innerHTML = '';
            el.style.cssText = 'padding:0; background:transparent; border:none; margin:8px 0;';

            const container = document.createElement('div');
            container.className = 'zhBypass-panel';
            container.style.textAlign = 'center';
            container.innerHTML = `
                <div class="zhBypass-subtext" style="margin-bottom:6px;">${origText}</div>
                <div class="zhBypass-hint" style="margin-bottom:16px;">知乎限制未登录用户每种排序只显示 3 条回答，点击下方按钮合并多种排序以加载更多</div>
                <div style="display:flex; justify-content:center; margin-bottom:16px;">
                    <button class="zhBypass-btn zhBypass-btn-primary zhBypass-loadBtn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                        加载更多回答
                    </button>
                </div>
                <div class="zhBypass-resultArea"></div>
            `;
            el.appendChild(container);

            // 加载更多回答：合并两种排序 + 渲染卡片 + iframe 浏览器
            // Load more answers: merge two sort orders + render cards + iframe browser
            container.querySelector('.zhBypass-loadBtn').addEventListener('click', async function () {
                const btn = this;
                btn.disabled = true;
                btn.textContent = '正在从不同排序加载...';
                const resultDiv = container.querySelector('.zhBypass-resultArea');

                const existingIds = extractCurrentAnswerIds();
                const allAnswers = {};

                const sorts = ['updated', 'default'];
                for (const sort of sorts) {
                    btn.textContent = `正在加载 ${sort} 排序...`;
                    const answers = await fetchSortedAnswers(qid, sort);
                    for (const aid in answers) {
                        if (!existingIds.has(aid)) {
                            allAnswers[aid] = answers[aid];
                        }
                    }
                }

                const newIds = Object.keys(allAnswers);
                if (newIds.length > 0) {
                    const cardsDiv = document.createElement('div');
                    cardsDiv.style.marginBottom = '16px';
                    const header = document.createElement('div');
                    header.className = 'zhBypass-subheading';
                    header.style.textAlign = 'left';
                    header.innerHTML = `额外加载了 <span class="zhBypass-countBadge">${newIds.length}</span> 条回答：`;
                    cardsDiv.appendChild(header);
                    for (const aid of newIds) {
                        renderAnswerCard(cardsDiv, qid, aid, allAnswers[aid]);
                    }
                    resultDiv.appendChild(cardsDiv);
                    btn.textContent = `已加载 ${newIds.length} 条新回答`;
                    btn.classList.add('zhBypass-btn-success');
                } else {
                    btn.textContent = '两种排序返回了相同的回答';
                    btn.classList.add('zhBypass-btn-warning');
                }

                // 合并所有已知 ID（页面原有 + 新加载），构建 iframe 浏览器
                // Merge all known IDs (existing + newly loaded), build iframe browser
                const allIds = [...existingIds, ...newIds];

                if (allIds.length > 0) {
                    const iframeSection = document.createElement('div');
                    iframeSection.className = 'zhBypass-divider';
                    let useFxzhihu = false;
                    iframeSection.innerHTML = `
                        <div class="zhBypass-flexBetween" style="margin-bottom:12px;">
                            <div>
                                <span class="zhBypass-subheading" style="margin-bottom:0;">回答浏览器</span>
                                <span class="zhBypass-countBadge" style="margin-left:8px;">${allIds.length}</span>
                            </div>
                            <label class="zhBypass-toggleLabel">
                                <input type="checkbox" class="zhBypass-switch zhBypass-fxToggle">
                                <span>fxzhihu.com</span>
                                <span class="zhBypass-tag">第三方</span>
                            </label>
                        </div>
                        <div class="zhBypass-idList zhBypass-idListBox"></div>
                        <div class="zhBypass-iframeBox" style="margin-top:12px;"></div>
                    `;
                    resultDiv.appendChild(iframeSection);

                    const fxToggle = iframeSection.querySelector('.zhBypass-fxToggle');
                    fxToggle.addEventListener('change', () => { useFxzhihu = fxToggle.checked; loadAnswer(currentIdx); });

                    const idList = iframeSection.querySelector('.zhBypass-idListBox');
                    const iframeBox = iframeSection.querySelector('.zhBypass-iframeBox');
                    let currentIdx = 0;

                    function loadAnswer(idx) {
                        if (idx < 0 || idx >= allIds.length) return;
                        currentIdx = idx;
                        const aid = allIds[idx];
                        const zhUrl = `https://www.zhihu.com/question/${qid}/answer/${aid}`;
                        const fxUrl = `https://www.fxzhihu.com/question/${qid}/answer/${aid}?redirect=false`;
                        const iframeSrc = useFxzhihu ? fxUrl : zhUrl;
                        iframeBox.innerHTML = `
                            <div class="zhBypass-browserNav">
                                <button class="zhBypass-navBtn zhBypass-prevBtn"${idx === 0 ? ' disabled' : ''}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-1px;margin-right:4px;"><polyline points="15 18 9 12 15 6"/></svg>上一条
                                </button>
                                <div class="zhBypass-browserNav-info">
                                    <span>${idx + 1} / ${allIds.length}</span>
                                    <a href="${zhUrl}" target="_blank">知乎</a>
                                    <a href="${fxUrl}" target="_blank">fxzhihu</a>
                                </div>
                                <button class="zhBypass-navBtn zhBypass-nextBtn"${idx === allIds.length - 1 ? ' disabled' : ''}>
                                    下一条<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-1px;margin-left:4px;"><polyline points="9 18 15 12 9 6"/></svg>
                                </button>
                            </div>
                            <iframe src="${iframeSrc}" class="zhBypass-iframe" ${useFxzhihu ? '' : 'sandbox="allow-same-origin allow-scripts allow-popups"'}></iframe>
                        `;
                        iframeBox.querySelector('.zhBypass-prevBtn').addEventListener('click', () => loadAnswer(currentIdx - 1));
                        iframeBox.querySelector('.zhBypass-nextBtn').addEventListener('click', () => loadAnswer(currentIdx + 1));

                        // 高亮当前
                        idList.querySelectorAll('a').forEach((a, i) => {
                            if (i === idx) {
                                a.classList.add('zhBypass-pill--active');
                            } else {
                                a.classList.remove('zhBypass-pill--active');
                            }
                        });
                    }

                    allIds.forEach((aid, idx) => {
                        const a = document.createElement('a');
                        a.href = '#';
                        a.textContent = `#${idx + 1}`;
                        a.title = `回答 ${aid}`;
                        a.className = 'zhBypass-pill';
                        a.addEventListener('click', (e) => { e.preventDefault(); loadAnswer(idx); });
                        idList.appendChild(a);
                    });

                    loadAnswer(0);
                }

                console.log(TAG, `加载完成：新增 ${newIds.length} 条，共 ${allIds.length} 条可浏览`);
            });

            console.log(TAG, '已替换"查看剩余回答"按钮');
        });
    }

    // =====================================================================
    // 第六部分：搜索页面优化
    // Part 6: Search Page Optimization
    // =====================================================================
    //
    // 【问题背景 / Problem background】
    // 知乎搜索（/search?q=xxx）需要 __zse_ck cookie 才能返回结果。
    // 这个 cookie 由知乎前端 JS 在用户浏览几个页面后自动生成。
    // 首次访问搜索页时如果没有这个 cookie，搜索结果为空。
    // Zhihu search (/search?q=xxx) requires __zse_ck cookie to return results.
    // This cookie is auto-generated by Zhihu's JS after browsing a few pages.
    // First visit to search page without this cookie yields empty results.
    //
    // 【解决方案 / Solution】
    // 1. 等待 2.5 秒检测是否有原生结果，如果有则不干预
    //    Wait 2.5s to check for native results, skip if present
    // 2. 如果无结果，注入备选搜索面板：
    //    If no results, inject fallback search panel:
    //    - 方法一：引导用户浏览几个页面生成 cookie 后刷新
    //      Method 1: Guide user to browse pages to generate cookie, then refresh
    //    - 方法二：通过外部搜索引擎（Google/Bing/百度/搜狗）+ site:zhihu.com
    //      Method 2: External search engines + site:zhihu.com
    // 3. 如果进入验证页（/unhuman），显示友好提示
    //    If on captcha page (/unhuman), show friendly prompt

    /**
     * 构建外部搜索引擎 URL（自动添加 site:zhihu.com 限定）
     * Build external search engine URL (auto-adds site:zhihu.com restriction)
     *
     * @param {string} engine - 搜索引擎标识: 'google' | 'bing' | 'baidu' | 'sogou'
     *                          Search engine identifier
     * @param {string} query - 搜索关键词 / Search keywords
     * @returns {string} 完整的搜索 URL / Complete search URL
     */
    function buildSearchUrl(engine, query) {
        const q = encodeURIComponent('site:zhihu.com ' + query);
        switch (engine) {
            case 'google': return 'https://www.google.com/search?q=' + q;
            case 'bing':   return 'https://www.bing.com/search?q=' + q;
            case 'baidu':  return 'https://www.baidu.com/s?wd=' + q;
            case 'sogou':  return 'https://www.sogou.com/web?query=' + q;
            default:       return 'https://www.google.com/search?q=' + q;
        }
    }

    /**
     * 创建搜索备选面板
     * Create Search Fallback Panel
     *
     * 当原生搜索无结果时，注入一个面板提供两种替代方案：
     * When native search returns no results, inject a panel with two alternatives:
     * 1. 引导用户生成 __zse_ck cookie / Guide user to generate __zse_ck cookie
     * 2. 外部搜索引擎入口（Google/Bing/百度/搜狗）/ External search engine entries
     *
     * 面板内的搜索关键词输入框支持实时编辑，按 Enter 更新所有引擎链接。
     * The keyword input in the panel supports live editing, press Enter to update all links.
     *
     * @param {string} query - 当前搜索关键词 / Current search query
     * @returns {Element} 备选面板 DOM 元素 / Fallback panel DOM element
     */
    function createSearchFallbackPanel(query) {
        const panel = document.createElement('div');
        panel.className = 'zhBypass-searchFallback zhBypass-panel';
        panel.style.maxWidth = '694px';
        panel.style.margin = '20px auto';
        const safeQuery = query.replace(/</g, '&lt;').replace(/"/g, '&quot;');

        panel.innerHTML = `
            <div style="margin-bottom:18px;">
                <div class="zhBypass-heading">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8590a6" stroke-width="2" style="vertical-align:-3px;margin-right:6px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    原生搜索未返回结果
                </div>
                <div class="zhBypass-subtext">
                    知乎搜索需要浏览器生成特殊 cookie（<code>__zse_ck</code>），以下方法可解决：
                </div>
            </div>
            <div class="zhBypass-infoBox" style="margin-bottom:16px;">
                <div class="zhBypass-subheading">方法一：让浏览器自动生成 cookie</div>
                <div style="color:#646464; font-size:13px; line-height:1.9;">
                    1. 先浏览 2-3 个知乎问题页面（如 <a href="https://www.zhihu.com/hot" class="zhBypass-link">热榜</a>）<br>
                    2. 然后回到搜索页刷新，原生搜索即可恢复<br>
                    3. 如果弹出验证码，完成验证即可（不需要登录）
                </div>
            </div>
            <div class="zhBypass-infoBox">
                <div class="zhBypass-subheading" style="margin-bottom:12px;">方法二：通过外部搜索引擎搜索知乎内容</div>
                <div style="display:flex; gap:8px; margin-bottom:14px;">
                    <input class="zhBypass-input zhBypass-fallbackInput" type="text" value="${safeQuery}" placeholder="输入关键词，按 Enter 更新链接...">
                </div>
                <div class="zhBypass-grid-4 zhBypass-fallbackBtns">
                    <a data-engine="google" href="${buildSearchUrl('google', query)}" target="_blank" rel="noopener" class="zhBypass-engineBtn">
                        <span class="zhBypass-engineIcon" style="background:#4285F4;">G</span> Google
                    </a>
                    <a data-engine="bing" href="${buildSearchUrl('bing', query)}" target="_blank" rel="noopener" class="zhBypass-engineBtn">
                        <span class="zhBypass-engineIcon" style="background:#00809d;">B</span> Bing
                    </a>
                    <a data-engine="baidu" href="${buildSearchUrl('baidu', query)}" target="_blank" rel="noopener" class="zhBypass-engineBtn">
                        <span class="zhBypass-engineIcon" style="background:#3385ff;">B</span> 百度
                    </a>
                    <a data-engine="sogou" href="${buildSearchUrl('sogou', query)}" target="_blank" rel="noopener" class="zhBypass-engineBtn">
                        <span class="zhBypass-engineIcon" style="background:#fb6022;">S</span> 搜狗
                    </a>
                </div>
                <div class="zhBypass-hint" style="margin-top:10px;">
                    自动添加 <code>site:zhihu.com</code>，搜索结果均来自知乎
                </div>
            </div>
        `;

        const input = panel.querySelector('.zhBypass-fallbackInput');
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const q = input.value.trim();
                if (!q) return;
                panel.querySelectorAll('.zhBypass-fallbackBtns a').forEach(a => {
                    a.href = buildSearchUrl(a.dataset.engine, q);
                });
            }
        });

        return panel;
    }

    /**
     * 搜索页面主处理函数
     * Search Page Main Handler
     *
     * 处理两种页面：
     * Handles two page types:
     * 1. /search — 搜索结果页（检测结果，必要时注入备选面板）
     *    /search — Search results page (detect results, inject fallback if needed)
     * 2. /unhuman — 验证码页（注入友好提示）
     *    /unhuman — Captcha page (inject friendly prompt)
     */
    function handleSearchPage() {
        const href = window.location.href;

        if (href.includes('/search')) {
            const query = new URLSearchParams(window.location.search).get('q') || '';

            setTimeout(() => {
                const hasResults = document.querySelectorAll('.SearchResult-Card, [class*="SearchResult"], .List-item').length > 0;
                if (hasResults) {
                    console.log(TAG, '搜索页有原生结果，无需干预');
                    return;
                }

                const main = document.querySelector('.SearchMain') || document.querySelector('.Search-container') || document.querySelector('#root');
                if (!main || main.querySelector('.zhBypass-searchFallback')) return;

                console.log(TAG, '搜索无结果，注入备选搜索面板');

                const sidebar = document.querySelector('.SearchSideBar') || document.querySelector('[class*="SearchSide"]');
                if (sidebar) sidebar.style.display = 'none';

                const contentArea = document.querySelector('.SearchMain .SearchMain-content') || main;
                const fallback = createSearchFallbackPanel(query);
                contentArea.prepend(fallback);
            }, 2500);
        }

        if (href.includes('/unhuman')) {
            onReady(() => {
                setTimeout(() => {
                    const root = document.querySelector('#root') || document.body;
                    if (!root || root.querySelector('.zhBypass-unhumanTip')) return;

                    const tip = document.createElement('div');
                    tip.className = 'zhBypass-unhumanTip zhBypass-warningBox';
                    tip.innerHTML = `
                        <div style="margin-bottom:8px;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d48806" stroke-width="2" style="vertical-align:-4px;margin-right:6px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            <span style="color:#d48806; font-size:15px; font-weight:600;">请完成下方验证</span>
                        </div>
                        <div style="color:#8c6d1f; font-size:13px; line-height:1.7;">完成验证码后，搜索功能即可正常使用（无需登录）。<br>验证完成后会自动返回搜索结果。</div>
                    `;
                    root.prepend(tip);
                }, 500);
            });
        }
    }

    // =====================================================================
    // 第七部分：用户主页增强
    // Part 7: User Profile Page Enhancement
    // =====================================================================
    //
    // 【问题背景 / Problem background】
    // 自 2024 年 5 月起，知乎对未登录用户完全屏蔽个人主页内容。
    // 服务端直接不返回用户的回答、文章列表数据（不是前端隐藏，是数据为空）。
    // Since May 2024, Zhihu completely blocks profile page content for non-logged-in users.
    // The server simply doesn't return user's answers/articles data (not hidden by frontend).
    //
    // 【解决方案 / Solution】
    // 无法绕过服务端限制，但可以提供替代浏览方式：
    // Can't bypass server-side restriction, but can provide alternative browsing:
    // 1. 从 js-initialData 提取用户基本信息（姓名、回答数、文章数）
    //    Extract basic user info from js-initialData (name, answer count, article count)
    // 2. 生成 4 个搜索引擎入口链接，搜索该用户在知乎的公开内容
    //    Generate 4 search engine entry links to search user's public content
    // 3. 显示为友好的"内容浏览助手"面板
    //    Display as a friendly "Content Browsing Helper" panel

    /**
     * 用户主页处理函数
     * User Profile Page Handler
     *
     * 检测条件：
     * Detection conditions:
     * 1. URL 匹配 /people/{urlToken} 路径 / URL matches /people/{urlToken} path
     * 2. 等待 2 秒让页面渲染完成 / Wait 2s for page to render
     * 3. 页面内容少于 2 个列表项（说明被服务端屏蔽）
     *    Less than 2 list items on page (indicates server-side blocking)
     * 4. 页面尚未注入过浏览助手 / Helper not already injected
     */
    function handleProfilePage() {
        const peopleMatch = window.location.pathname.match(/^\/people\/([^/?#]+)/);
        if (!peopleMatch) return;
        const urlToken = peopleMatch[1];

        setTimeout(() => {
            const profileMain = document.querySelector('.Profile-main') || document.querySelector('[class*="ProfileMain"]');
            if (!profileMain) return;

            if (profileMain.querySelector('.zhBypass-profileHelper')) return;

            const listItems = profileMain.querySelectorAll('.List-item, .ContentItem');
            if (listItems.length > 2) return;

            let userName = '';
            let answerCount = 0;
            let articleCount = 0;
            try {
                const raw = document.getElementById('js-initialData')?.textContent;
                if (raw) {
                    const d = JSON.parse(raw);
                    const users = d?.initialState?.entities?.users || {};
                    const user = users[urlToken];
                    if (user) {
                        userName = user.name || '';
                        answerCount = user.answerCount || 0;
                        articleCount = user.articlesCount || 0;
                    }
                }
            } catch (_) {}

            const displayName = userName || urlToken;
            const initial = displayName.charAt(0);

            const googleSearchAnswers = encodeURIComponent(`site:zhihu.com "${displayName}" 的回答`);

            const panel = document.createElement('div');
            panel.className = 'zhBypass-profileHelper zhBypass-panel';

            const statsHtml = answerCount
                ? `<div style="display:flex; gap:16px; margin-bottom:16px;">
                    <div style="padding:10px 20px; background:#f0f7ff; border-radius:8px; text-align:center;">
                        <div style="font-size:20px; font-weight:700; color:#0066ff;">${answerCount}</div>
                        <div style="font-size:12px; color:#8590a6; margin-top:2px;">回答</div>
                    </div>
                    ${articleCount ? `<div style="padding:10px 20px; background:#f0f7ff; border-radius:8px; text-align:center;">
                        <div style="font-size:20px; font-weight:700; color:#0066ff;">${articleCount}</div>
                        <div style="font-size:12px; color:#8590a6; margin-top:2px;">文章</div>
                    </div>` : ''}
                </div>`
                : '';

            panel.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
                    <div class="zhBypass-card-avatar" style="width:40px;height:40px;font-size:16px;">${escapeHTML(initial)}</div>
                    <div>
                        <div class="zhBypass-heading" style="margin-bottom:2px;">用户内容浏览助手</div>
                        <div class="zhBypass-hint">帮助你浏览 ${escapeHTML(displayName)} 的公开内容</div>
                    </div>
                </div>
                <div class="zhBypass-subtext" style="margin-bottom:16px; padding:12px 16px; background:#f6f6f6; border-radius:8px;">
                    知乎限制未登录用户查看个人主页内容（服务端不传输数据）。以下提供替代方式浏览：
                </div>
                ${statsHtml}
                <div class="zhBypass-grid-2" style="margin-bottom:12px;">
                    <a href="https://www.google.com/search?q=${googleSearchAnswers}" target="_blank" rel="noopener" class="zhBypass-engineBtn">
                        <span class="zhBypass-engineIcon" style="background:#4285F4;">G</span> Google 搜索回答
                    </a>
                    <a href="https://www.bing.com/search?q=${encodeURIComponent(`site:zhihu.com "${displayName}" 的回答`)}" target="_blank" rel="noopener" class="zhBypass-engineBtn">
                        <span class="zhBypass-engineIcon" style="background:#00809d;">B</span> Bing 搜索回答
                    </a>
                </div>
                <div class="zhBypass-grid-2" style="margin-bottom:16px;">
                    <a href="https://www.baidu.com/s?wd=${encodeURIComponent(`site:zhihu.com "${displayName}"`)}" target="_blank" rel="noopener" class="zhBypass-engineBtn">
                        <span class="zhBypass-engineIcon" style="background:#3385ff;">B</span> 百度搜索
                    </a>
                    <a href="https://www.sogou.com/web?query=${encodeURIComponent(`site:zhihu.com "${displayName}"`)}" target="_blank" rel="noopener" class="zhBypass-engineBtn">
                        <span class="zhBypass-engineIcon" style="background:#fb6022;">S</span> 搜狗搜索
                    </a>
                </div>
                <div class="zhBypass-hint" style="padding:10px 16px; background:#f6f6f6; border-radius:8px;">
                    搜索引擎通常收录了用户的公开回答和文章。也可以先浏览几个知乎页面（生成 cookie）后刷新此页面。
                </div>
            `;

            const tabContent = profileMain.querySelector('.Profile-mainColumn') || profileMain;
            const firstChild = tabContent.querySelector('.List, .Profile-emptyText, [class*="ProfileEmpty"]') || tabContent.firstElementChild;
            if (firstChild) {
                firstChild.parentNode.insertBefore(panel, firstChild);
            } else {
                tabContent.prepend(panel);
            }

            console.log(TAG, '已在用户主页注入内容浏览助手');
        }, 2000);
    }

    // =====================================================================
    // 第八部分：主清理 + MutationObserver + 初始化
    // Part 8: Main Cleanup + MutationObserver + Initialization
    // =====================================================================
    //
    // 本部分是脚本的调度中枢，负责：
    // This part is the script's scheduling hub, responsible for:
    // 1. executeBypass() — 节流调度核心清理操作 / Throttled dispatch of core cleanup
    // 2. setupObserver() — MutationObserver 监控 DOM 变化 / MutationObserver for DOM changes
    // 3. 初始化流程 — 按正确顺序启动所有模块 / Initialization in correct order
    // 4. 定时器兜底 — 处理延迟渲染的弹窗 / Timer fallback for delayed modals
    // 5. 调试接口 — 暴露到 window.zhihuBypass / Debug API on window.zhihuBypass

    /**
     * 核心执行函数（带 200ms 时间戳节流）
     * Core Execution Function (with 200ms timestamp throttle)
     *
     * 【为什么需要节流？/ Why throttle?】
     * executeBypass() 会被以下三个来源触发：
     * executeBypass() is triggered by three sources:
     * 1. 定时器（前 5 秒，每 500ms）/ Timer (first 5s, every 500ms)
     * 2. MutationObserver（DOM 变化时）/ MutationObserver (on DOM changes)
     * 3. 滚动事件（已简化为只调 restoreScroll）/ Scroll (simplified to restoreScroll only)
     *
     * 知乎弹窗通常在 DOMContentLoaded 后 1-3 秒延迟出现，
     * 期间定时器和 Observer 可能同时触发，200ms 节流避免冗余执行。
     * Zhihu modals typically appear 1-3s after DOMContentLoaded,
     * timer and Observer may fire simultaneously, 200ms throttle prevents redundancy.
     *
     * 【与 debounce 的区别 / Difference from debounce】
     * throttle 保证 200ms 内最多执行一次，但不延迟首次调用；
     * debounce 会延迟执行直到停止触发，可能导致弹窗短暂可见。
     * Throttle guarantees at most one execution per 200ms without delaying first call;
     * debounce would delay until triggers stop, potentially showing modal briefly.
     */
    let _lastBypass = 0;
    function executeBypass() {
        const now = Date.now();
        if (now - _lastBypass < 200) return; // 200ms 内不重复执行 / Skip if within 200ms
        _lastBypass = now;
        removeLoginModal();
        restoreScroll();
        expandContent();
        patchViewAllButton();
    }

    /**
     * 设置 MutationObserver 监控 DOM 变化
     * Setup MutationObserver for DOM Change Monitoring
     *
     * 【监控策略 / Monitoring strategy】
     * - 监控 document.body 的 childList + subtree（捕获所有 DOM 插入）
     *   Watch document.body's childList + subtree (capture all DOM insertions)
     * - 只在发现以下特征时触发完整清理：
     *   Only trigger full cleanup when these patterns are detected:
     *   - 新节点类名包含 'Modal' 或 'signFlow' / New node class contains 'Modal' or 'signFlow'
     *   - 新节点内含 .Modal-wrapper / .signFlowModal / .ViewAll / New node contains these selectors
     * - 对每个新节点还执行：/ For each new node also execute:
     *   - 清理链接重定向 / Clean link redirects
     *   - 折叠盐选内容 / Collapse salt-select content
     *   - 检测并隐藏 fixed 登录浮窗 / Detect and hide fixed login widgets
     */
    function setupObserver() {
        const domObs = new MutationObserver(muts => {
            let needBypass = false;
            for (const m of muts) {
                for (const n of m.addedNodes) {
                    if (!n || n.nodeType !== 1) continue;
                    const cls = typeof n.className === 'string' ? n.className : '';

                    if (cls.includes('Modal') || cls.includes('signFlow')) {
                        needBypass = true;
                    }
                    if (n.querySelector) {
                        if (n.querySelector('.Modal-wrapper, .signFlowModal, .ViewAll')) {
                            needBypass = true;
                        }
                    }

                    if (n.children && n.children.length <= 10) {
                        const btn = n.querySelector && n.querySelector('button');
                        if (btn && btn.textContent && btn.textContent.includes('登录')) {
                            try {
                                const s = window.getComputedStyle(n);
                                if (s.position === 'fixed' && parseInt(s.bottom, 10) < 200) {
                                    n.style.display = 'none';
                                }
                            } catch (_) {}
                        }
                    }

                    if (n.querySelectorAll) removeRedirects(n);
                    collapseSaltContent(n);
                }
            }
            if (needBypass) executeBypass();
        });

        if (document.body) {
            domObs.observe(document.body, { childList: true, subtree: true });
        }

        watchOverflow();
    }

    // =====================================================================
    // 初始化流程
    // Initialization Flow
    // =====================================================================
    //
    // 【执行顺序说明 / Execution order notes】
    // 以下操作在 DOMContentLoaded 后按顺序执行：
    // The following operations execute in order after DOMContentLoaded:
    //
    // 1. injectCSS()         — 确保样式已注入（CSS 注入有幂等检查）
    //                           Ensure CSS is injected (has idempotency check)
    // 2. patchInitialData()  — 再次尝试 patch（可能 earlyObs 没来得及）
    //                           Retry patch (earlyObs may have missed it)
    // 3. executeBypass()     — 首次完整清理
    //                           First full cleanup
    // 4. setupObserver()     — 启动 DOM 监控
    //                           Start DOM monitoring
    // 5. handleSearchPage()  — 搜索页特殊处理
    //                           Search page special handling
    // 6. handleProfilePage() — 用户主页特殊处理
    //                           Profile page special handling
    // 7. removeRedirects()   — 清理已有链接的重定向
    //                           Clean redirects in existing links
    // 8. 定时器 + 滚动监听  — 兜底机制
    //                           Timer + scroll listener as fallback

    onReady(() => {
        console.log(TAG, '初始化 v4.2.1');
        injectCSS();
        patchInitialData();
        executeBypass();
        setupObserver();
        handleSearchPage();
        handleProfilePage();
        removeRedirects();

        // 定时器兜底：前 5 秒（10 次 x 500ms）定期执行清理
        // Timer fallback: periodic cleanup for first 5 seconds (10 x 500ms)
        // 知乎弹窗可能延迟 1-3 秒才渲染，定时器确保不遗漏
        // Zhihu modals may render with 1-3s delay, timer ensures coverage
        // 5 秒后由 MutationObserver 接管，定时器自动停止
        // After 5s, MutationObserver takes over, timer auto-stops
        let n = 0;
        const tid = setInterval(() => {
            executeBypass();
            if (++n >= 10) clearInterval(tid);
        }, 500);

        // 滚动事件：仅恢复滚动（轻量操作）
        // Scroll event: only restore scroll (lightweight operation)
        // 弹窗移除由 Observer 负责，滚动时不需要完整清理
        // Modal removal is Observer's job, no need for full cleanup on scroll
        // 使用 300ms 手动节流，passive: true 不阻塞滚动
        // Uses 300ms manual throttle, passive: true won't block scrolling
        let scrollTimer = null;
        window.addEventListener('scroll', () => {
            if (scrollTimer) return;
            scrollTimer = setTimeout(() => {
                restoreScroll();
                scrollTimer = null;
            }, 300);
        }, { passive: true });

        console.log(TAG, '初始化完成');
    });

    /**
     * 调试接口
     * Debug API
     *
     * 暴露内部函数到 window.zhihuBypass，方便开发者在控制台调试：
     * Exposes internal functions to window.zhihuBypass for developer debugging:
     *
     * 使用方法（在浏览器控制台输入）/ Usage (type in browser console):
     *   zhihuBypass.removeModal()    — 手动触发弹窗移除 / Manually trigger modal removal
     *   zhihuBypass.restoreScroll()  — 手动恢复滚动 / Manually restore scroll
     *   zhihuBypass.expandContent()  — 手动展开内容 / Manually expand content
     *   zhihuBypass.executeBypass()  — 手动执行完整清理 / Manually run full cleanup
     *   zhihuBypass.buildSearchUrl('google', '关键词') — 构建搜索 URL / Build search URL
     *   zhihuBypass.version          — 查看版本号 / Check version
     */
    window.zhihuBypass = {
        removeModal: removeLoginModal,
        restoreScroll,
        expandContent,
        executeBypass,
        buildSearchUrl,
        version: '4.2.1'
    };

})();
