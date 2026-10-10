# BiliBiliDownloader-electron

**当前版本：2.0.0**

BiliBiliDownloader-electron 是一款基于 Electron、Vue 3 和 Element Plus 的哔哩哔哩视频下载桌面应用，支持账号登录、视频与收藏夹解析、批量下载及下载任务管理。

## 功能

- 支持 Bilibili 扫码登录和 Cookie 登录。
- 搜索视频并查看可下载的画质和音频选项；受账号权限或视频源限制的选项会显示为不可用。
- 下载视频、音频或封面，也可一次下载全部内容。
- 支持 MP3、杜比全景声和 Hi-Res 无损音频；实际可用选项取决于视频源和账号权限。
- 浏览登录账号的收藏夹，支持一次加载收藏夹内的视频并加入下载列表。
- 管理待下载、下载中和已完成任务；下载过程中可暂停和继续。
- 配置默认下载选项，并设置保存路径。
- 下载记录保存在本机应用数据目录中。

## Windows 安装

前往 [GitHub Releases](https://github.com/SnowDreamXUE/BiliBiliDownloader-electron/releases) 下载最新的 Windows x64 安装包，运行安装程序并按提示完成安装。

当前 Windows 安装包未进行代码签名，首次安装或启动时，Windows 可能显示安全提示。

## 使用说明

1. 打开“账号登录”页面扫码登录，或导入 Cookie。搜索和公开视频下载可按需使用；收藏夹需要登录。
2. 在搜索页解析视频，或在收藏夹页面选择收藏夹并加载视频。
3. 将要下载的视频加入待下载列表，在设置中选择默认画质、音频和保存路径。
4. 在下载页点击“全部下载设置”，选择本次批量下载视频、音频、封面或全部内容。
5. 开始下载后，可在“下载中”页面查看进度并暂停或继续任务；完成的文件和记录可在“已完成”页面查看。

部分画质和音频选项受 Bilibili 账号等级、登录状态、视频源和版权限制。应用只会提供当前账号和视频可用的选项。

## 从源码运行

### 环境要求

- Windows 10/11 x64
- [Node.js](https://nodejs.org/) 20 或更高版本
- npm
- 项目中的 `assets/aria2c.exe` 和 `assets/ffmpeg.exe` 下载及媒体处理工具

### 安装依赖并启动

```bash
git clone https://github.com/SnowDreamXUE/BiliBiliDownloader-electron.git
cd BiliBiliDownloader-electron
npm install
npm run dev
```

### 构建

```bash
# 构建应用资源
npm run build

# 生成 Windows x64 安装包
npm run build:win
```

安装包输出到 `dist/`。项目目前主要面向 Windows；虽然配置中包含 macOS 和 Linux 构建脚本，但下载工具目前随项目提供的是 Windows 版本，其他平台尚未完整支持。

## 技术栈

- [Electron](https://www.electronjs.org/)
- [Vue 3](https://vuejs.org/)
- [Element Plus](https://element-plus.org/)
- [Pinia](https://pinia.vuejs.org/)
- [Vue Router](https://router.vuejs.org/)
- [aria2](https://aria2.github.io/)
- [FFmpeg](https://ffmpeg.org/)

## 项目结构

```text
├── assets/                    # aria2c.exe、ffmpeg.exe
├── build/                     # 应用图标和平台构建资源
├── resources/                 # 应用资源
├── src/
│   ├── main/                  # Electron 主进程、下载和本地数据存储
│   ├── preload/               # 主进程与渲染进程之间的安全接口
│   └── renderer/               # Vue 页面和组件
├── VERSION                    # 当前版本号
├── electron-builder.yml       # 安装包构建配置
└── package.json               # 项目依赖和脚本
```

## 免责声明

本项目仅供学习和个人使用。请遵守 Bilibili 用户协议及适用法律，尊重内容创作者的版权。请勿将下载内容用于未经授权的传播或商业用途。

## 许可证

本项目遵循 [LICENSE](./LICENSE) 中的许可条款。
