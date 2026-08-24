# 每日西语 · 手机版 App(PWA)

把 Obsidian 里的每日西语笔记变成**离线可用的手机卡片 App**。装到桌面像原生 App,不用服务器。

**🌐 线上地址**:https://tttfiona.github.io/daily-spanish/(手机扫码即开,可添加到主屏幕)

## 怎么用

### 本地打开
```bash
cd "/Users/vipt88/Documents/Fiona知识库/08-西语学习/app"
python3 -m http.server 8000
```
手机和电脑连同一 WiFi,手机浏览器打开 `http://<电脑IP>:8000`。
**装到桌面**:浏览器菜单 →「添加到主屏幕」(iOS)/「安装应用」(Android)。

### 更新课程数据
在 Obsidian 生成新日记后,跑一次导出:
```bash
python3 "/Users/vipt88/Documents/Fiona知识库/08-西语学习/app/export.py"
```
会重新生成 `lessons.json`,手机端**下拉/重开即可**(数据走网络优先)。

## 结构
| 文件 | 作用 |
|---|---|
| `export.py` | 日记 Markdown → `lessons.json` |
| `index.html` / `styles.css` / `app.js` | 应用本体(零依赖) |
| `manifest.webmanifest` / `sw.js` | PWA 离线 + 安装 |
| `icon.svg` / `icon-192.png` / `icon-512.png` | 图标 |

## 功能
- 今日课 / 全部课程 / 到期复习 三个 tab
- 生词**点卡片翻转**看释义,带例句
- 开口句**🔊 朗读**(手机系统西语发音)
- 复习按 **1/3/7/15/30 天**自动排期
- 连续打卡 🔥,进度存手机本地

## 复制成新语言产品(自用模板化)
1. 换 `lessons.json`(任何语言/课程,`meta.name` 改标题)
2. 改 `manifest.webmanifest` 的名字、`styles.css` 主题色、换 `icon.*`
3. 部署到 GitHub Pages / Netlify,扫码即用
