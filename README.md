# Tavern Vault · 酒馆典藏柜

可本地自部署的 **SillyTavern** 私人档案仓库，采用**拟物设计（Skeuomorphic UI）**与 **Vue 3 + Node.js** 架构，零外部数据库依赖，开箱即用。

## 功能特性

- **多格式智能识别与批量导入**：拖放上传自动识别以下 SillyTavern 档案类型：
  - **角色卡（Character Card）**：支持 V1 / V2 / V3 `.json` 及内嵌 `chara` / `ccv3` 元数据块的 `.png` 角色卡，自动提取封面原画、作者说明、备选开场白、内嵌世界书与正则脚本。
  - **对话预设（Preset）**：支持 Chat Completion / Text Completion 预设，展示采样参数 LCD 仪表盘，支持按名称/启用状态检索全部提示词模块。
  - **界面主题（Theme）**：实时渲染主题色板与迷你气泡预览，一键复制色值与完整 `custom_css`。
  - **世界书（World Info）与正则/扩展**：支持独立世界书词条检索与正则脚本归档。
- **格式互转与原件无损保存**：
  - 所有上传文件均以原件无损存储于本地 `data/files/`，元数据索引存储于本地 SQLite（`data/vault.db`）。
  - 支持 `.png` 角色卡一键提取导出为 `.json`；也支持为 `.json` 角色卡上传 PNG 封面后封装导出为标准 `.png` 角色卡。
- **分类整理**：支持星标收藏、自定义档案抽屉（文件夹）、多标签筛选、全文搜索与个人归档备注。
- **拟物美学界面**：胡桃木桌面、缝线马鞍皮侧栏、拉丝黄铜铭牌、亚麻羊皮纸卷宗卡、模拟硬件预设模块与发光 LED 状态灯。

## 环境要求

- **Node.js >= 22.5**（内置 `node:sqlite`，无需额外编译 C++ 原生模块）
- 或使用 **Docker / Docker Compose** 一键部署

## 快速部署

### 方式一：本地 Node.js 直接运行

```bash
# 1. 安装前后端依赖
npm run install:all

# 2. 构建前端静态资源
npm run build

# 3. 启动本地服务（默认端口 3456）
npm start
```

启动后在浏览器访问：`http://localhost:3456`

可通过环境变量自定义端口与数据目录：

```bash
# PowerShell
$env:PORT=8080; $env:VAULT_DATA_DIR="D:\MyTavernData"; npm start
```

### 方式二：开发模式（热重载）

```bash
npm run dev
```

- 前端开发服务器：`http://localhost:5173`
- 后端 API 服务：`http://localhost:3456`

### 方式三：Docker Compose 部署

```bash
docker compose up -d --build
```

数据会持久化挂载在宿主机 `./data` 目录。

## 数据备份与迁移

所有用户数据均保存在项目根目录的 `data/` 文件夹下：

- `data/vault.db`：SQLite 元数据索引数据库
- `data/files/`：所有导入的原始 `.png` / `.json` 文件
- `data/covers/`：角色卡与档案封面图

只需定期备份 `data/` 目录即可完成完整备份与迁移。
