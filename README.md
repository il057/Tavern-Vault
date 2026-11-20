# Tavern Vault · 酒馆档案墙

可本地自部署的 **SillyTavern** 私人档案仓库，采用**现代工作室公告板风格（Modern Studio Bulletin Board）**与 **Vue 3 + Node.js** 架构，零外部数据库依赖，开箱即用。

## 功能特性

- **多格式智能识别与批量导入**：拖放上传自动识别以下 SillyTavern 档案类型：
  - **角色卡（Character Card）**：支持 V1 / V2 / V3 `.json` 及内嵌 `chara` / `ccv3` 元数据块的 `.png` 角色卡，自动提取封面原画、作者说明、备选开场白、内嵌世界书与正则脚本。
  - **对话预设（Preset）**：支持 Chat Completion / Text Completion 预设，展示采样参数 OLED 仪表盘，支持按名称与启用状态检索全部提示词模块。
  - **界面主题（Theme）**：实时渲染主题色板与迷你气泡预览，一键复制色值与完整 `custom_css`。
  - **世界书（World Info）与正则/扩展**：支持独立世界书词条检索，以及正则脚本的 **HTML/CSS 沙盒实时渲染预览与自定义文本实测**。
- **格式互转与原件无损保存**：
  - 所有上传文件均以原件无损存储于本地 `data/files/`，元数据索引存储于本地 SQLite（`data/vault.db`）。
  - 支持 `.png` 角色卡一键提取导出为 `.json`；也支持为 `.json` 角色卡上传 PNG 封面后封装导出为标准 `.png` 角色卡。
- **分类整理**：支持星标收藏、自定义收藏分组（文件夹）、多标签筛选、全文搜索与个人归档备注。
- **现代工作室公告板界面 & 日夜模式**：
  - 点阵公告板画布、毛玻璃顶部控制台、图钉与和纸胶带卡片、阳极氧化硬件预设模块、OLED 参数读数屏与发光 LED 状态灯。
  - 支持**浅色模式 / 深色模式 / 跟随系统自动切换**，顶栏一键切换，刷新无白屏闪烁。

## 环境要求

- **Node.js >= 22.5**（内置 `node:sqlite`，无需额外编译 C++ 原生模块）
- 或使用 **Docker / Docker Compose** 一键部署
- Windows 后台常驻运行可选配 **NSSM（Non-Sucking Service Manager）**

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

```powershell
# PowerShell
$env:PORT=8080; $env:VAULT_DATA_DIR="D:\MyTavernData"; npm start
```

### 方式二：Windows 本地 NSSM 后台服务（开机自启）

如果希望在 Windows 上作为后台服务常驻运行并开机自启，可使用内置的 NSSM 服务脚本 [scripts/nssm-service.ps1](scripts/nssm-service.ps1)。

1. 安装依赖并构建前端（首次部署）：

```powershell
npm run install:all
npm run build
```

2. 安装 NSSM（若尚未安装）：

```powershell
winget install NSSM.NSSM
# 或 scoop install nssm
```

3. **以管理员身份打开 PowerShell**，注册并启动服务：

```powershell
# 默认配置安装（服务名 TavernVault，端口 3456，自动配置日志轮转与异常重启）
npm run service:install

# 如需自定义端口、数据目录或手动指定 nssm.exe 路径：
.\scripts\nssm-service.ps1 install -Port 8080 -DataDir "D:\MyTavernData" -NssmPath "C:\tools\nssm\nssm.exe"
```

常用服务管理命令：

```powershell
npm run service:status     # 查看服务状态
npm run service:restart    # 重启服务（更新构建后使用）
npm run service:stop       # 停止服务
npm run service:start      # 启动服务
npm run service:logs       # 查看服务最近日志（保存在 logs/ 目录）
npm run service:uninstall  # 停止并卸载服务
```

### 方式三：开发模式（热重载）

```bash
npm run dev
```

- 前端开发服务器：`http://localhost:5173`
- 后端 API 服务：`http://localhost:3456`

### 方式四：Docker Compose 部署

```bash
docker compose up -d --build
```

数据会持久化挂载在宿主机 `./data` 目录。

## 数据备份与迁移

默认情况下，所有用户数据均保存在项目根目录的 `data/` 文件夹下（如需自定义存储位置，可通过环境变量 `VAULT_DATA_DIR` 指定）：

- `data/vault.db`：SQLite 元数据索引数据库（启用 WAL 模式，运行期间可能存在 `vault.db-wal` / `vault.db-shm`）
- `data/files/`：所有导入的原始 `.png` / `.json` 文件
- `data/covers/`：角色卡与档案封面图

建议在停止服务后备份或迁移整个 `data/` 目录，即可完成完整备份与恢复。
