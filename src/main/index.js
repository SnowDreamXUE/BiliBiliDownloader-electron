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

function createWindow() {
  // Create the browser window.
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

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
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

// 在适当位置添加
ipcMain.handle("set-cookies", async (event, cookieData) => {
  return await setCookies(cookieData);
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
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


  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on("ping", () => console.log("pong"));

  createWindow();

  app.on("activate", function() {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
