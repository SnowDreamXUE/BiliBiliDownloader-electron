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
  isLoggedIn: () => ipcRenderer.invoke('is-logged-in')
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
