# BiliBili Downloader

BiliBili Downloader 是一款基于Electron和Vue开发的桌面应用程序，用于下载哔哩哔哩视频网站的视频内容。

## 功能特点

- 支持B站账号登录，通过扫码或Cookie方式
- 视频搜索与浏览
- 高清视频下载
- 自定义下载目录
- 下载任务管理（等待中、下载中、已下载）
- 支持视频和音频合并
- 视频封面下载
- 支持音频提取

## 系统要求

- Windows 7及以上版本
- 最小屏幕分辨率: 1100 x 700

## 安装使用

### 方法一：下载预构建版本

1. 前往[Releases](https://github.com/yourusername/BiliBiliDownloader-electron/releases)页面
2. 下载最新版本的安装包
3. 运行安装程序并按提示操作

### 方法二：从源码构建

#### 前提条件

- [Node.js](https://nodejs.org/) (推荐v16及以上)
- [npm](https://www.npmjs.com/) 或 [yarn](https://yarnpkg.com/)

#### 步骤

```bash
# 克隆仓库
git clone https://github.com/yourusername/BiliBiliDownloader-electron.git

# 进入项目目录
cd BiliBiliDownloader-electron

# 安装依赖
npm install
# 或
yarn install

# 运行开发版本
npm run dev
# 或
yarn dev

# 构建生产版本
npm run build:win  # Windows版本
# 或
yarn build:win

# 其他平台构建
npm run build:mac     # Mac版本
npm run build:linux   # Linux版本
```

## 使用指南

1. **登录账号**：支持扫码登录或Cookie导入
2. **搜索视频**：在搜索栏输入关键词查找视频
3. **下载视频**：点击视频卡片上的下载按钮
4. **管理下载**：在"下载管理"标签页可查看和管理下载状态
5. **设置下载目录**：在设置中可自定义视频保存位置

## 技术栈

- [Electron](https://www.electronjs.org/): 桌面应用程序框架
- [Vue 3](https://vuejs.org/): 前端框架
- [Element Plus](https://element-plus.org/): UI组件库
- [Pinia](https://pinia.vuejs.org/): 状态管理
- [Vue Router](https://router.vuejs.org/): 路由管理
- [Aria2](https://aria2.github.io/): 用于高效下载
- [FFmpeg](https://ffmpeg.org/): 用于视频音频处理

## 项目结构

```
├── build/                 # 构建相关资源
├── resources/             # 应用资源（aria2c.exe, ffmpeg.exe等）
├── src/
│   ├── main/             # Electron主进程代码
│   │   ├── cookieSet.js       # Cookie管理
│   │   ├── dataStorage.js     # 数据存储
│   │   ├── downloadManager.js # 下载管理
│   │   ├── downloadTools.js   # 下载工具
│   │   └── index.js           # 主进程入口
│   ├── preload/          # 预加载脚本
│   └── renderer/         # 渲染进程（前端）代码
│       ├── src/
│       │   ├── components/    # Vue组件
│       │   ├── router/        # 路由配置
│       │   ├── stores/        # Pinia存储
│       │   └── views/         # 页面视图
│       └── index.html         # HTML模板
├── electron.vite.config.mjs  # Electron Vite配置
├── electron-builder.yml      # Electron Builder配置
└── package.json              # 项目依赖和脚本
```

## 许可证

本项目遵循[LICENSE](./LICENSE)文件中指定的许可证。

## 免责声明

本软件仅供学习和研究使用，请勿用于非法用途或违反哔哩哔哩用户协议的行为。用户应当尊重内容创作者的版权，不得将下载的内容用于商业目的。


## 致谢

- [Electron](https://www.electronjs.org/)
- [Vue](https://vuejs.org/)
- [Element Plus](https://element-plus.org/)
- [Aria2](https://aria2.github.io/)
- [FFmpeg](https://ffmpeg.org/)
