本地运行说明
============

1. 必须用本地 HTTP 服务器打开（不能直接双击 index.html）

2. 在项目根目录 chatchat 下执行：
   python -m http.server 8080

3. 浏览器访问：http://localhost:8080/web/

UI 说明
-------
界面仿照墨刀原型「朋友圈文案助手.mdrp」：
- 主色 #1DE6AC，辅助蓝 #7FB3D5 / #A9CCE3
- 欢迎页 → 首页（为你推荐）→ 答题匹配（确认弹窗 + 扭蛋抽取 + 三条结果）
- AI 定制 / 我的（收藏 + 复制记录）

功能：今日三条 | 微定制答题 | AI 匹配 | 收藏
语料：tagging/output/tagged_corpus.json

