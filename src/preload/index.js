import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  platform: process.platform, // 在这里添加平台信息

  // 添加HTTP请求API
  http: {
    request: (options) => ipcRenderer.invoke('send-http-request', options),
    get: (url, params, headers) => ipcRenderer.invoke('send-http-request', {
      method: 'get',
      url,
      params,
      headers
    }),
    post: (url, data, headers) => ipcRenderer.invoke('send-http-request', {
      method: 'post',
      url,
      data,
      headers
    })
  },

  // 添加Cookie相关API
  setCookies: (cookieData) => ipcRenderer.invoke('set-cookies', cookieData),
  saveCookies: () => ipcRenderer.invoke('save-cookies'),
  clearCookies: () => ipcRenderer.invoke('clear-cookies'),
  getCookies: () => ipcRenderer.invoke('get-cookies'),
  isLoggedIn: () => ipcRenderer.invoke('is-logged-in'),

  // 添加数据存储相关API
  storage: {
    // 下载信息相关
    getDownloadsInfo: () => ipcRenderer.invoke('get-downloads-info'),
    saveDownloadInfo: (downloadInfo) => ipcRenderer.invoke('save-download-info', downloadInfo),
    removeDownloadInfo: (avid) => ipcRenderer.invoke('remove-download-info', avid),
    updateDownloadInfoPage: (avid, cid, updateData) => ipcRenderer.invoke('update-download-info-page', avid, cid, updateData),
    removeDownloadInfoPage: (avid, cid) => ipcRenderer.invoke('remove-download-info-page', avid, cid),

    // 下载中任务相关
    getDownloadingTasks: () => ipcRenderer.invoke('get-downloading-tasks'),
    addDownloadingTask: (task) => ipcRenderer.invoke('add-downloading-task', task),
    updateDownloadingTask: (avid, cid, updateData) => ipcRenderer.invoke('update-downloading-task', avid, cid, updateData),
    removeDownloadingTask: (avid, cid) => ipcRenderer.invoke('remove-downloading-task', avid, cid),

    // 已完成任务相关
    getCompletedTasks: () => ipcRenderer.invoke('get-completed-tasks'),
    addCompletedTask: (task) => ipcRenderer.invoke('add-completed-task', task),
    removeCompletedTask: (avid, cid) => ipcRenderer.invoke('remove-completed-task', avid, cid),

    // 任务状态转换
    moveTaskToCompleted: (avid, cid, additionalData) => ipcRenderer.invoke('move-task-to-completed', avid, cid, additionalData)
  }
}

// 定义窗口控制API
const windowAPI = {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onMaximizeChange: (callback) => {
    const listener = (_, isMaximized) => callback(isMaximized)
    ipcRenderer.on('window-maximized', listener)
    return () => {
      ipcRenderer.removeListener('window-maximized', listener)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', {
      ...electronAPI,
      window: windowAPI
    })
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = {
    ...electronAPI,
    window: windowAPI
  }
  window.api = api
}
