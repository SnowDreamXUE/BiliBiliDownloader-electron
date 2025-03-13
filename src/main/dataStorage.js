import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

// 数据存储基础路径
const DATA_DIR = path.join(app.getPath('userData'), 'data');
const DOWNLOADS_INFO_FILE = path.join(DATA_DIR, 'downloads-info.json');
const DOWNLOADING_FILE = path.join(DATA_DIR, 'downloading.json');
const COMPLETED_FILE = path.join(DATA_DIR, 'completed.json');

// 确保数据目录存在
function ensureDataDirExists() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

// 初始化存储文件
async function initStorage() {
  ensureDataDirExists();

  // 检查并初始化各个JSON文件
  for (const file of [DOWNLOADS_INFO_FILE, DOWNLOADING_FILE, COMPLETED_FILE]) {
    if (!existsSync(file)) {
      await fs.writeFile(file, JSON.stringify([], null, 2), 'utf8');
    }
  }
}

// 读取JSON文件
async function readJsonFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    // 如果文件不存在或格式错误，返回空数组
    return [];
  }
}

// 写入JSON文件
async function writeJsonFile(filePath, data) {
  ensureDataDirExists();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// 获取下载信息列表
export async function getDownloadsInfo() {
  await initStorage();
  return await readJsonFile(DOWNLOADS_INFO_FILE);
}

// 保存新的下载信息
export async function saveDownloadInfo(downloadInfo) {
  await initStorage();
  const downloads = await getDownloadsInfo();

  // 检查是否已存在相同avid，避免重复添加
  const existingIndex = downloads.findIndex(item => item.avid === downloadInfo.avid);
  if (existingIndex >= 0) {
    // 更新已有信息
    downloads[existingIndex] = downloadInfo;
  } else {
    // 添加新信息
    downloads.push(downloadInfo);
  }

  await writeJsonFile(DOWNLOADS_INFO_FILE, downloads);
  return { success: true, message: '下载信息已保存' };
}

// 删除指定的下载信息
export async function removeDownloadInfo(avid) {
  const downloads = await getDownloadsInfo();
  const newDownloads = downloads.filter(item => item.avid !== avid);

  if (downloads.length === newDownloads.length) {
    return { success: false, message: '未找到指定的下载信息' };
  }

  await writeJsonFile(DOWNLOADS_INFO_FILE, newDownloads);
  return { success: true, message: '下载信息已删除' };
}

// 更新下载信息的某一页
export async function updateDownloadInfoPage(avid, cid, updateData) {
  const downloads = await getDownloadsInfo();
  const downloadIndex = downloads.findIndex(item => item.avid === avid);

  if (downloadIndex === -1) {
    return { success: false, message: '未找到指定的下载信息' };
  }

  const pageIndex = downloads[downloadIndex].pages.findIndex(page => page.cid === cid);
  if (pageIndex === -1) {
    return { success: false, message: '未找到指定的页面信息' };
  }

  // 更新页面数据
  downloads[downloadIndex].pages[pageIndex] = {
    ...downloads[downloadIndex].pages[pageIndex],
    ...updateData
  };

  await writeJsonFile(DOWNLOADS_INFO_FILE, downloads);
  return { success: true, message: '页面信息已更新' };
}

// 删除下载信息中的某一页
export async function removeDownloadInfoPage(avid, cid) {
  const downloads = await getDownloadsInfo();
  const downloadIndex = downloads.findIndex(item => item.avid === avid);

  if (downloadIndex === -1) {
    return { success: false, message: '未找到指定的下载信息' };
  }

  const pages = downloads[downloadIndex].pages;
  const newPages = pages.filter(page => page.cid !== cid);

  if (pages.length === newPages.length) {
    return { success: false, message: '未找到指定的页面' };
  }

  downloads[downloadIndex].pages = newPages;

  // 如果删除后没有页面了，可以选择删除整个下载信息
  if (newPages.length === 0) {
    const newDownloads = downloads.filter(item => item.avid !== avid);
    await writeJsonFile(DOWNLOADS_INFO_FILE, newDownloads);
  } else {
    await writeJsonFile(DOWNLOADS_INFO_FILE, downloads);
  }

  return { success: true, message: '页面已删除' };
}

// === 下载中的任务管理 ===
export async function getDownloadingTasks() {
  await initStorage();
  return await readJsonFile(DOWNLOADING_FILE);
}

export async function addDownloadingTask(task) {
  const tasks = await getDownloadingTasks();
  // 防止重复添加
  const existingIndex = tasks.findIndex(t => t.avid === task.avid && t.cid === task.cid);

  if (existingIndex >= 0) {
    tasks[existingIndex] = { ...task, updatedAt: new Date().toISOString() };
  } else {
    tasks.push({
      ...task,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progress: 0
    });
  }

  await writeJsonFile(DOWNLOADING_FILE, tasks);
  return { success: true };
}

export async function updateDownloadingTask(avid, cid, updateData) {
  const tasks = await getDownloadingTasks();
  const taskIndex = tasks.findIndex(task => task.avid === avid && task.cid === cid);

  if (taskIndex === -1) {
    return { success: false, message: '未找到指定的下载任务' };
  }

  tasks[taskIndex] = {
    ...tasks[taskIndex],
    ...updateData,
    updatedAt: new Date().toISOString()
  };

  await writeJsonFile(DOWNLOADING_FILE, tasks);
  return { success: true };
}

export async function removeDownloadingTask(avid, cid) {
  const tasks = await getDownloadingTasks();
  const newTasks = tasks.filter(task => !(task.avid === avid && task.cid === cid));

  if (tasks.length === newTasks.length) {
    return { success: false, message: '未找到指定的下载任务' };
  }

  await writeJsonFile(DOWNLOADING_FILE, newTasks);
  return { success: true };
}

// === 已完成的任务管理 ===
export async function getCompletedTasks() {
  await initStorage();
  return await readJsonFile(COMPLETED_FILE);
}

export async function addCompletedTask(task) {
  const tasks = await getCompletedTasks();
  // 添加完成时间
  const completedTask = {
    ...task,
    completedAt: new Date().toISOString()
  };

  // 防止重复添加
  const existingIndex = tasks.findIndex(t => t.avid === task.avid && t.cid === task.cid);
  if (existingIndex >= 0) {
    tasks[existingIndex] = completedTask;
  } else {
    tasks.push(completedTask);
  }

  await writeJsonFile(COMPLETED_FILE, tasks);
  return { success: true };
}

export async function removeCompletedTask(avid, cid) {
  const tasks = await getCompletedTasks();
  const newTasks = tasks.filter(task => !(task.avid === avid && task.cid === cid));

  if (tasks.length === newTasks.length) {
    return { success: false, message: '未找到指定的已完成任务' };
  }

  await writeJsonFile(COMPLETED_FILE, newTasks);
  return { success: true };
}

// 将下载中的任务移动到已完成任务
export async function moveTaskToCompleted(avid, cid, additionalData = {}) {
  const tasks = await getDownloadingTasks();
  const taskIndex = tasks.findIndex(task => task.avid === avid && task.cid === cid);

  if (taskIndex === -1) {
    return { success: false, message: '未找到指定的下载任务' };
  }

  const task = tasks[taskIndex];
  // 从下载中移除
  await removeDownloadingTask(avid, cid);
  // 添加到已完成
  await addCompletedTask({
    ...task,
    ...additionalData,
    progress: 100
  });

  return { success: true };
}
