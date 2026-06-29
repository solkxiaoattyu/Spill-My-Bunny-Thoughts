# 04 · 设计资源

YourWord 前端用到的图片、图标与源稿归档。**运行时以 `01_前端应用/public/` 为准**；本目录是素材源与同步脚本。

## 目录说明

```
04_设计资源/
├── README.md                    ← 本文件
├── sync_to_frontend.py          ← 一键同步到 public/
├── scripts/
│   └── remove_profile_card_bg.py ← 个人页插画抠透明底
├── public静态资源/              ← 已处理、可直接上线的静态文件
│   ├── avatar.png
│   ├── hero-cover.jpg / .png
│   ├── welcome-splash.png
│   ├── gift-box-closed.png / gift-box-open.png
│   ├── moments-preview/01~09.jpg
│   └── profile-cards/           ← 透明底插画（个人主页）
├── icon/                        ← 首页操作按钮
│   ├── select.png               ← 随机抽取
│   └── catch.png                ← 标签速配
├── gift礼盒图/                  ← 礼盒原始导出（2=关，3=开）
├── 源文件/                      ← 设计稿 / AI 生成原图（勿删）
│   ├── profile-cards/           ← 抠图前插画
│   ├── hero/                    ← 封面、启动页相关原稿
│   ├── gift/                    ← 礼盒 SVG 与导出源
│   └── misc/                    ← 其它未定稿素材
```

## 常用命令

```bash
# 1. 同步全部静态资源 → 01_前端应用/public/
python sync_to_frontend.py

# 2. 重新抠个人页插画透明底（需 Pillow：pip install pillow）
python scripts/remove_profile_card_bg.py

# 建议顺序：先抠图，再 sync_to_frontend
```

## 与前端路径对应

| public 路径 | 用途 |
|-------------|------|
| `/hero-cover.jpg` | 首页顶部封面 |
| `/welcome-splash.png` | 启动页 |
| `/avatar.png` | 默认头像 |
| `/gift-box-closed.png` / `open.png` | 随机抽取礼盒 |
| `/moments-preview/01~09.jpg` | 朋友圈预览九宫格 |
| `/profile-cards/*.png` | 个人主页五张卡片插画 |
| `/icon/select.png` / `catch.png` | 首页「随机抽取 / 标签速配」 |

## 礼盒源文件对照

| 源文件 | 同步后文件名 |
|--------|----------------|
| `gift礼盒图/2.png` | `public静态资源/gift-box-closed.png` |
| `gift礼盒图/3.png` | `public静态资源/gift-box-open.png` |

换图时改 `public静态资源/` 中同名文件，再运行 `sync_to_frontend.py`。
