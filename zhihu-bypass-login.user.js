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

(function () {
    'use strict';

    // 防止与其他知乎脚本冲突：检查是否已经有相同功能的脚本在运行
    if (window.__zhBypassEnhanced) return;
    window.__zhBypassEnhanced = true;

    const TAG = '[知乎免登录]';

    // =====================================================================
    // 第一部分：document-start 阶段 — 在页面 JS 执行前完成拦截
    // =====================================================================

    // 1. Hook fetch：把需要登录的 403 API 响应替换为空数据，避免触发登录弹窗
    //    注意：不拦截搜索 API，让搜索走原生流程
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
        return originalFetch.apply(this, args).then(response => {
            const url = (typeof args[0] === 'string') ? args[0] : (args[0]?.url || '');
            // 只拦截回答/feed 相关的 403，不拦截搜索
            if (response.status === 403 && (url.includes('/feeds') || url.includes('/answers'))) {
                return response.clone().text().then(text => {
                    try {
                        const data = JSON.parse(text);
                        if (data?.error?.need_login || data?.error?.code === 40353 || data?.error?.code === 40362) {
                            console.log(TAG, '拦截 403 need_login:', url.substring(0, 80));
                            return new Response(JSON.stringify({ data: [], paging: { is_end: true, next: '' } }), {
                                status: 200, headers: { 'Content-Type': 'application/json' }
                            });
                        }
                    } catch (_) {}
                    return response;
                }).catch(() => response);
            }
            return response;
        });
    };

    // 2. 监控 js-initialData 插入，尽早修改 needForceLogin / isDrained
    function patchInitialData() {
        const el = document.getElementById('js-initialData');
        if (!el) return false;
        try {
            const d = JSON.parse(el.textContent);
            let changed = false;
            const qAnswers = d?.initialState?.question?.answers;
            if (qAnswers) {
                for (const qid in qAnswers) {
                    if (qAnswers[qid].needForceLogin) { qAnswers[qid].needForceLogin = false; changed = true; }
                    if (qAnswers[qid].isDrained) { qAnswers[qid].isDrained = false; changed = true; }
                }
            }
            if (changed) {
                el.textContent = JSON.stringify(d);
                console.log(TAG, '已 patch initialData (needForceLogin / isDrained)');
            }
            return changed;
        } catch (_) { return false; }
    }

    const earlyObs = new MutationObserver(muts => {
        for (const m of muts) for (const n of m.addedNodes) {
            if (n.id === 'js-initialData' || (n.querySelector && n.querySelector('#js-initialData'))) {
                patchInitialData();
                earlyObs.disconnect();
                return;
            }
        }
    });
    earlyObs.observe(document.documentElement, { childList: true, subtree: true });

    // =====================================================================
    // 第二部分：防止跳转到登录页
    // =====================================================================

    (function blockLoginRedirect() {
        // Hook history API：阻止 JS 跳转到登录页
        const wrapHistory = (orig) => function (...a) {
            const u = String(a[2] || '');
            if (u.includes('/signin') || u.includes('/login')) {
                console.log(TAG, '阻止 history 跳转到登录页:', u);
                return;
            }
            return orig.apply(this, a);
        };
        history.pushState = wrapHistory(history.pushState);
        history.replaceState = wrapHistory(history.replaceState);

        // 如果已经在登录页，重定向到有用的页面
        const href = window.location.href;
        if (href.includes('/signin') || href.includes('/login')) {
            const ref = document.referrer || '';
            if (ref && ref.includes('zhihu.com') && !ref.includes('/signin') && !ref.includes('/login')) {
                window.location.replace(ref);
            } else {
                window.location.replace('https://www.zhihu.com/hot');
            }
        }
    })();

    // =====================================================================
    // 第三部分：CSS 注入 — 完整的样式系统
    // =====================================================================

    function injectCSS() {
        if (document.getElementById('zhBypass-styles')) return;
        const style = document.createElement('style');
        style.id = 'zhBypass-styles';
        style.textContent = `
/* === 登录弹窗隐藏 === */
.signFlowModal { display: none !important; }
.Modal-backdrop { display: none !important; }

/* === 基础设计令牌 === */
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

/* === 回答卡片 === */
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

/* === 按钮系统 === */
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

/* === 导航按钮（上一条/下一条）=== */
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

/* === 回答编号药丸 === */
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

/* === 搜索引擎按钮 === */
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

/* === Toggle 开关 === */
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

/* === Toggle 标签 === */
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

/* === 输入框 === */
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

/* === iframe === */
.zhBypass-iframe {
    width: 100%;
    height: 600px;
    border: 1px solid #ebebeb;
    border-radius: 10px;
}

/* === 信息框 === */
.zhBypass-infoBox {
    background: #f6f6f6;
    border-radius: 10px;
    padding: 16px 20px;
}

/* === 警告框（验证页）=== */
.zhBypass-warningBox {
    max-width: 600px;
    margin: 24px auto;
    padding: 20px 24px;
    background: linear-gradient(135deg, #fffef5 0%, #fffbe6 100%);
    border: 1px solid #ffe58f;
    border-radius: 12px;
    text-align: center;
}

/* === 文字排版 === */
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

/* === 布局 === */
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

/* === 标签 === */
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

/* === code 样式 === */
.zhBypass-panel code {
    padding: 2px 6px;
    background: #f0f2f7;
    border-radius: 4px;
    font-size: 12px;
    font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
    color: #e83e8c;
}

/* === 链接通用 === */
.zhBypass-link {
    color: #0066ff;
    text-decoration: none;
    transition: color 0.2s;
}
.zhBypass-link:hover {
    color: #0052cc;
    text-decoration: underline;
}

/* === 浏览器导航栏 === */
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

/* === 计数徽章 === */
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

/* === 响应式 === */
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
    // =====================================================================

    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    /* --- 移除登录弹窗 --- */
    function removeLoginModal() {
        let removed = false;

        // 1. 精确匹配知乎弹窗类名
        document.querySelectorAll('.signFlowModal').forEach(e => {
            const wrapper = e.closest('.Modal-wrapper');
            if (wrapper) { wrapper.remove(); removed = true; }
            else { e.remove(); removed = true; }
        });

        // 2. Modal-wrapper 内含登录/注册文案的
        document.querySelectorAll('.Modal-wrapper').forEach(e => {
            const t = e.textContent || '';
            if (t.includes('登录') || t.includes('注册') || t.includes('密码') || t.includes('扫码')) {
                e.remove();
                removed = true;
            }
        });

        // 3-4：浅层 DOM 扫描 fixed/sticky 登录元素（body 直接子节点 + 一级孙节点）
        // fixed/sticky 元素必然在 DOM 浅层，无需遍历全部 3000+ div
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
            if (childCount >= 15) continue;
            const t = e.textContent || '';

            // step 3：右下角 fixed/sticky 登录提示框
            if ((t.includes('登录即可查看') || t.includes('立即登录/注册')) && childCount < 10) {
                try {
                    const s = window.getComputedStyle(e);
                    if (s.position === 'fixed' || s.position === 'sticky') {
                        e.remove(); removed = true; continue;
                    }
                } catch (_) {}
            }

            // step 4：含"登录"按钮的 fixed 小浮窗
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

        // 5：内嵌登录推荐面板 — 先用 children.length 过滤（跳过 95% 的 div），再读 textContent
        document.querySelectorAll('div').forEach(e => {
            if (e._zhBypHidden) return;
            const childCount = e.children.length;
            if (childCount <= 2 || childCount >= 15) return;
            if ((e.textContent || '').includes('登录知乎，您可以享受以下权益')) {
                e.style.display = 'none';
                e._zhBypHidden = true;
                removed = true;
            }
        });

        if (removed) {
            console.log(TAG, '已移除登录弹窗');
        }
        return removed;
    }

    /* --- 恢复滚动 --- */
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

    /* --- 监控 html overflow 属性变化 --- */
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
        htmlObs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    }

    /* --- 展开被截断的内容 --- */
    function expandContent() {
        document.querySelectorAll('[class*="RichContent-inner"]').forEach(e => {
            if (e.style.maxHeight || e.style.overflow === 'hidden') {
                e.style.maxHeight = 'none';
                e.style.overflow = 'visible';
            }
        });
        document.querySelectorAll('[class*="RichContent"] button, .ContentItem button').forEach(b => {
            const t = b.textContent.trim();
            if (t === '阅读全文' || t === '展开阅读全文') b.click();
        });
    }

    /* --- 移除链接重定向 --- */
    function removeRedirects(root) {
        (root || document).querySelectorAll('a[href*="link.zhihu.com"]').forEach(link => {
            const match = /link\.zhihu\.com\/\?target=(.+)$/.exec(link.href);
            if (match) {
                try { link.href = decodeURIComponent(match[1]); } catch (_) {}
            }
        });
    }

    /* --- 折叠盐选内容 --- */
    function collapseSaltContent(node) {
        if (node && node.matches && node.matches('.List-item') && node.querySelector('.KfeCollection-AnswerTopCard-Container')) {
            const collapseBtn = node.querySelector('.RichContent-collapsedText');
            if (collapseBtn) collapseBtn.click();
        }
    }

    // =====================================================================
    // 第五部分：扩展回答查看功能
    // =====================================================================

    /* --- 从 initialData 中提取当前页面已有的回答 ID --- */
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

    /* --- 通过 SSR 页面获取不同排序的回答 --- */
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

    /* --- HTML 转义 --- */
    const _escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function escapeHTML(str) {
        return str.replace(/[&<>"']/g, c => _escapeMap[c]);
    }

    /* --- 渲染回答卡片 --- */
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

    /* --- 替换"查看剩余回答"按钮 --- */
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

            // 加载更多回答：合并两种排序 + iframe 浏览
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

                // 合并所有已知 ID，提供 iframe 浏览
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
    // =====================================================================

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
    // =====================================================================

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
    // 第八部分：主清理 + MutationObserver
    // =====================================================================

    // 200ms 时间戳节流：合并定时器/Observer/滚动的重复调用，不阻止任何调用最终执行
    let _lastBypass = 0;
    function executeBypass() {
        const now = Date.now();
        if (now - _lastBypass < 200) return;
        _lastBypass = now;
        removeLoginModal();
        restoreScroll();
        expandContent();
        patchViewAllButton();
    }

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
    // 初始化
    // =====================================================================

    onReady(() => {
        console.log(TAG, '初始化 v4.2.1');
        injectCSS();
        patchInitialData();
        executeBypass();
        setupObserver();
        handleSearchPage();
        handleProfilePage();
        removeRedirects();

        // 前 5 秒定期清理（处理延迟渲染的弹窗，后续由 Observer 覆盖）
        let n = 0;
        const tid = setInterval(() => {
            executeBypass();
            if (++n >= 10) clearInterval(tid);
        }, 500);

        // 滚动时仅恢复滚动（轻量操作），弹窗移除由 Observer 负责
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

    // 调试接口
    window.zhihuBypass = {
        removeModal: removeLoginModal,
        restoreScroll,
        expandContent,
        executeBypass,
        buildSearchUrl,
        version: '4.2.1'
    };

})();
