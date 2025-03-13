import { app, shell, BrowserWindow, ipcMain, session } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import axios from "axios";
import {
  saveCookiesToFile,
  loadCookiesFromFile,
  clearAllCookies,
  getCurrentCookies,
  getCookieString,
  isLoggedIn, setCookies
} from "./cookieSet";
import {
  getDownloadsInfo,
  saveDownloadInfo,
  removeDownloadInfo,
  updateDownloadInfoPage,
  removeDownloadInfoPage,
  getDownloadingTasks,
  addDownloadingTask,
  updateDownloadingTask,
  removeDownloadingTask,
  getCompletedTasks,
  addCompletedTask,
  removeCompletedTask,
  moveTaskToCompleted
} from './dataStorage';
import { initDownloadManager } from './downloadManager';


function createWindow() {
  const mainWindow = new BrowserWindow({
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    icon: icon,
    frame: false,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.setTitle("BiliBiliDownloader");
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // 监听窗口最大化状态变化
  mainWindow.on("maximize", () => {
    mainWindow.webContents.send("window-maximized", true);
  });

  mainWindow.on("unmaximize", () => {
    mainWindow.webContents.send("window-maximized", false);
  });

  // 处理窗口操作的IPC消息
  ipcMain.on("window-minimize", () => {
    mainWindow.minimize();
  });

  ipcMain.on("window-maximize", () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on("window-close", () => {
    mainWindow.close();
  });

  ipcMain.handle("window-is-maximized", () => {
    return mainWindow.isMaximized();
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// 设置全局请求头部拦截
function setupGlobalHeaders() {
  // 拦截所有会话的webRequest
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ["*://*/*"] },
    (details, callback) => {
      // 设置B站API常用请求头
      details.requestHeaders["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
      details.requestHeaders["Referer"] = "https://www.bilibili.com";
      callback({ requestHeaders: details.requestHeaders });
    }
  );
}

// 添加IPC处理HTTP请求，自动携带cookies
ipcMain.handle("send-http-request", async (event, options) => {
  try {
    // 获取cookies字符串
    const cookieString = await getCookieString();

    // 处理请求头
    const headers = options.headers || {};

    // 如果存在cookies且请求域名是bilibili相关域名，则携带cookies
    if (cookieString && (
      options.url.includes('bilibili.com') ||
      options.url.includes('bilivideo.com')
    )) {
      headers.Cookie = cookieString;
    }

    const response = await axios({
      method: options.method || "get",
      url: options.url,
      headers: headers,
      data: options.data || {},
      params: options.params || {},
      withCredentials: true // 允许跨域请求携带凭证
    });

    return {
      data: response.data,
      status: response.status,
      headers: response.headers
    };
  } catch (error) {
    console.error("HTTP请求错误:", error);
    return {
      error: {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      }
    };
  }
});

// 数据存储相关
function registerDataStorageHandlers() {
  // 下载信息相关
  ipcMain.handle('get-downloads-info', getDownloadsInfo);
  ipcMain.handle('save-download-info', (event, downloadInfo) => saveDownloadInfo(downloadInfo));
  ipcMain.handle('remove-download-info', (event, avid) => removeDownloadInfo(avid));
  ipcMain.handle('update-download-info-page', (event, avid, cid, updateData) =>
    updateDownloadInfoPage(avid, cid, updateData));
  ipcMain.handle('remove-download-info-page', (event, avid, cid) =>
    removeDownloadInfoPage(avid, cid));

  // 下载中任务相关
  ipcMain.handle('get-downloading-tasks', getDownloadingTasks);
  ipcMain.handle('add-downloading-task', (event, task) => addDownloadingTask(task));
  ipcMain.handle('update-downloading-task', (event, avid, cid, updateData) =>
    updateDownloadingTask(avid, cid, updateData));
  ipcMain.handle('remove-downloading-task', (event, avid, cid) =>
    removeDownloadingTask(avid, cid));

  // 已完成任务相关
  ipcMain.handle('get-completed-tasks', getCompletedTasks);
  ipcMain.handle('add-completed-task', (event, task) => addCompletedTask(task));
  ipcMain.handle('remove-completed-task', (event, avid, cid) =>
    removeCompletedTask(avid, cid));

  // 任务状态转换
  ipcMain.handle('move-task-to-completed', (event, avid, cid, additionalData) =>
    moveTaskToCompleted(avid, cid, additionalData));
}

// 设置cookies
ipcMain.handle("set-cookies", async (event, cookieData) => {
  return await setCookies(cookieData);
});

// 打开文件
ipcMain.handle('open-path', async (event, path) => {
  try {
    const result = await shell.openPath(path);
    return { success: result === '' }; // openPath成功时返回空字符串
  } catch (error) {
    console.error('打开文件失败:', error);
    return { success: false, error: error.message };
  }
});

// 在文件管理器中显示文件
ipcMain.handle('show-item-in-folder', async (event, path) => {
  try {
    shell.showItemInFolder(path);
    return { success: true };
  } catch (error) {
    console.error('显示文件失败:', error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(async () => {

  // 设置系统环境变量，解决中文乱码问题
  process.env.LANG = 'zh_CN.UTF-8';

  // 加载保存的cookies
  await loadCookiesFromFile();
  // 拦截修改请求头
  setupGlobalHeaders();
  // Set app user model id for windows
  electronApp.setAppUserModelId("com.electron");

  // 注册IPC处理器
  ipcMain.handle("save-cookies", saveCookiesToFile);
  ipcMain.handle("clear-cookies", clearAllCookies);
  ipcMain.handle("get-cookies", getCurrentCookies);
  ipcMain.handle("is-logged-in", isLoggedIn);

  // 注册数据存储相关的处理器
  registerDataStorageHandlers();

  // 初始化下载管理器
  initDownloadManager();

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on("ping", () => console.log("pong"));

  createWindow();

  app.on("activate", function() {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
