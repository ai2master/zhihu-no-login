# 知乎免登录浏览增强版

Tampermonkey / Violentmonkey 用户脚本，绕过知乎登录限制，无需账号即可正常浏览。

## 功能

- **移除登录弹窗** — 自动清除登录/注册弹窗，恢复页面滚动
- **解锁更多回答** — 合并多种排序加载额外回答（知乎默认只显示 3 条）
- **回答浏览器** — 内置 iframe 浏览器，支持上一条/下一条快速切换
- **恢复原生搜索** — 搜索不可用时提供备选方案（Google/Bing/百度/搜狗 站内搜索）
- **自动展开内容** — 自动点击"阅读全文"，展开被折叠的回答
- **防跳转登录页** — 拦截 JS 跳转到 `/signin`、`/login`
- **移除链接重定向** — 去除 `link.zhihu.com` 中间跳转
- **折叠盐选广告** — 自动折叠盐选付费内容
- **用户主页助手** — 个人主页被限制时提供搜索引擎替代浏览
- **fxzhihu.com 支持** — 可选使用第三方代理浏览回答（非默认）

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)
2. 点击下方链接安装脚本：

   **[安装脚本](https://raw.githubusercontent.com/ai2master/zhihu-no-login/main/zhihu-bypass-login.user.js)**

3. 访问知乎任意页面，脚本自动运行

## 兼容性

- 浏览器：Chrome / Edge / Firefox / Safari（需安装用户脚本管理器）
- 脚本管理器：Tampermonkey / Violentmonkey / Greasemonkey

## 已知限制

- **用户主页**：知乎服务端不向未登录用户传输个人主页内容数据（2024 年 5 月起），脚本提供搜索引擎替代方案
- **搜索功能**：首次使用需先浏览几个知乎页面让浏览器生成 `__zse_ck` cookie，之后搜索恢复正常
- **回答数量**：受限于知乎 SSR 机制，每种排序最多获取 3 条回答，合并后约 6 条

## License

MIT
