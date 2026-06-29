# Spill My Bunny Thoughts · YourWord

朋友圈文案智能匹配小程序：根据情绪 / 场景 / 风格 / 用途，从 5500+ 条人工清洗语料中抽签匹配朋友圈文案，支持问卷匹配、AI 语义理解、离线向量召回三种模式。

线上访问：**https://solkxiaoattyu.github.io/Spill-My-Bunny-Thoughts/**

## 目录结构

```
01_前端应用/        React + Vite 前端（本小程序）
  src/             源码
  scripts/         语料向量构建脚本（Python）
02_语料与数据/
  corpus/          活跃语料库（tagged_corpus.json / corpus_vectors.json）
03_数据打标后端/    DeepSeek 批量打标脚本与标签枚举
.github/workflows/ GitHub Pages 自动部署工作流
```

## 本地开发

```bash
cd 01_前端应用
npm install
npm run dev        # 本地开发，base 默认 "/"
```

## 构建

```bash
cd 01_前端应用
npm run build      # 产出 dist/
```

> 部署到 GitHub Pages 子路径时需设置 `VITE_BASE=/Spill-My-Bunny-Thoughts/`，CI 已自动处理。

## 部署

推送到 `main` 分支后，`.github/workflows/deploy.yml` 会自动：
1. `npm ci` 安装依赖
2. 用 Python 重建语料向量索引
3. `npm run build` 构建（base 设为 `/Spill-My-Bunny-Thoughts/`）
4. 部署 `dist/` 到 GitHub Pages

需在仓库 **Settings → Pages → Build and deployment → Source** 选择 `GitHub Actions`。

## 标签体系 v2.0

维度：`mood / scene / style / purpose / theme / relation / tone_level`（已移除 length / format / content_rating）。
详见 `03_数据打标后端/config/tags_enum.json`。
