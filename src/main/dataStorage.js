import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

// 数据存储基础路径
const DATA_DIR = path.join(app.getPath('userData'), 'data');
const DOWNLOADS_INFO_FILE = path.join(DATA_DIR, 'downloads-info.json');
const DOWNLOADING_FILE = path.join(DATA_DIR, 'downloading.json');
const COMPLETED_FILE = path.join(DATA_DIR, 'completed.json');
let downloadingTaskUpdateQueue = Promise.resolve();
let completedTaskWriteQueue = Promise.resolve();
let storageInitialization;

// 初始化存储文件
async function initStorage() {
  if (!storageInitialization) {
    storageInitialization = (async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });

      for (const file of [DOWNLOADS_INFO_FILE, DOWNLOADING_FILE, COMPLETED_FILE]) {
        try {
          await fs.access(file);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;

          try {
            await fs.writeFile(file, JSON.stringify([], null, 2), { encoding: 'utf8', flag: 'wx' });
          } catch (writeError) {
            if (writeError.code !== 'EEXIST') throw writeError;
          }
        }
      }
    })().catch(error => {
      storageInitialization = null;
      throw error;
    });
  }

  return storageInitialization;
}

export async function initializeDataStorage() {
  await initStorage();
}

function serializeCompletedTaskWrite(operation) {
  const result = completedTaskWriteQueue.then(operation);
  completedTaskWriteQueue = result.catch(() => {});
  return result;
}

function upsertCompletedTask(tasks, task) {
  const completedTask = {
    ...task,
    completedAt: new Date().toISOString()
  };

  const existingIndex = tasks.findIndex(item => item.avid === task.avid && item.cid === task.cid);
  if (existingIndex >= 0) {
    tasks[existingIndex] = completedTask;
  } else {
    tasks.push(completedTask);
  }

  return tasks;
}

// 原子替换文件，避免读取方看到被截断的 JSON。
async function writeJsonFile(filePath, data) {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const temporaryPath = `${filePath}.tmp`;
  try {
    await fs.writeFile(temporaryPath, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

// 读取JSON文件
async function readJsonFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      throw new Error(`JSON数据不是数组: ${filePath}`);
    }
    return parsed;
  } catch (error) {
    console.error(`读取文件失败 ${filePath}:`, error);
    return [];
  }
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
  const operation = downloadingTaskUpdateQueue.then(async () => {
    const tasks = await getDownloadingTasks();
    // 防止重复添加
    const existingIndex = tasks.findIndex(t => t.avid === task.avid && t.cid === task.cid);

    // 确保保存合集信息
    const taskWithDetails = {
      ...task,
      isCompilations: task.isCompilations || false,
      videoName: task.videoName || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progress: task.progress || 0
    };

    if (existingIndex >= 0) {
      // 更新任务时保留原有合集信息
      const existingTask = tasks[existingIndex];
      tasks[existingIndex] = {
        ...taskWithDetails,
        isCompilations: taskWithDetails.isCompilations || existingTask.isCompilations,
        videoName: taskWithDetails.videoName || existingTask.videoName,
        createdAt: existingTask.createdAt || taskWithDetails.createdAt,
        updatedAt: new Date().toISOString()
      };
    } else {
      tasks.push(taskWithDetails);
    }

    await writeJsonFile(DOWNLOADING_FILE, tasks);
    return { success: true };
  });

  downloadingTaskUpdateQueue = operation.catch(() => {});
  return operation;
}

export async function updateDownloadingTask(avid, cid, updateData) {
  const operation = downloadingTaskUpdateQueue.then(async () => {
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
  });

  downloadingTaskUpdateQueue = operation.catch(() => {});
  return operation;
}

export async function removeDownloadingTask(avid, cid) {
  const operation = downloadingTaskUpdateQueue.then(async () => {
    const tasks = await getDownloadingTasks();
    const newTasks = tasks.filter(task => !(task.avid === avid && task.cid === cid));

    if (tasks.length === newTasks.length) {
      return { success: false, message: '未找到指定的下载任务' };
    }

    await writeJsonFile(DOWNLOADING_FILE, newTasks);
    return { success: true };
  });

  downloadingTaskUpdateQueue = operation.catch(() => {});
  return operation;
}

// === 已完成的任务管理 ===
export async function getCompletedTasks() {
  await initStorage();
  return await readJsonFile(COMPLETED_FILE);
}

export async function addCompletedTask(task) {
  return serializeCompletedTaskWrite(async () => {
    await initStorage();
    const tasks = upsertCompletedTask(await readJsonFile(COMPLETED_FILE), task);
    await writeJsonFile(COMPLETED_FILE, tasks);
    return { success: true };
  });
}

export async function removeCompletedTask(avid, cid) {
  return serializeCompletedTaskWrite(async () => {
    await initStorage();
    const tasks = await readJsonFile(COMPLETED_FILE);
    const newTasks = tasks.filter(task => !(task.avid === avid && task.cid === cid));

    if (tasks.length === newTasks.length) {
      return { success: false, message: '未找到指定的已完成任务' };
    }

    await writeJsonFile(COMPLETED_FILE, newTasks);
    return { success: true };
  });
}

// 将下载中的任务移动到已完成任务
export async function moveTaskToCompleted(avid, cid, additionalData = {}) {
  return serializeCompletedTaskWrite(async () => {
    await initStorage();
    const tasks = await getDownloadingTasks();
    const taskIndex = tasks.findIndex(task => task.avid === avid && task.cid === cid);

    if (taskIndex === -1) {
      return { success: false, message: '未找到指定的下载任务' };
    }

    const task = tasks[taskIndex];
    const completedTasks = upsertCompletedTask(await readJsonFile(COMPLETED_FILE), {
      ...task,
      ...additionalData,
      progress: 100
    });

    // 先持久化完成记录，再从进行中列表移除，尽量避免故障时丢失历史。
    await writeJsonFile(COMPLETED_FILE, completedTasks);
    await removeDownloadingTask(avid, cid);

    return { success: true };
  });
}
