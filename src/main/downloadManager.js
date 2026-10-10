import { dialog, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import {
  convertToMp3,
  deleteFile,
  downloadFile,
  getDownloadDir,
  mergeVideoAudio,
  remuxAudio,
  setDownloadDir
} from './downloadTools';
import {
  addDownloadingTask,
  getDownloadingTasks,
  moveTaskToCompleted,
  updateDownloadingTask
} from './dataStorage';

const activeDownloads = new Map();

export async function initDownloadManager() {
  ipcMain.handle('select-download-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择下载目录'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const dirPath = result.filePaths[0];
      setDownloadDir(dirPath);
      return { success: true, path: dirPath };
    }
    return { success: false };
  });

  ipcMain.handle('get-download-directory', () => getDownloadDir());

  ipcMain.handle('start-download', async (event, downloadItem) => {
    const key = `${downloadItem.avid}-${downloadItem.cid}`;
    if (activeDownloads.has(key)) {
      return { success: false, message: '该任务已在下载队列中' };
    }

    const taskPromise = startDownload(downloadItem);

    if (!activeDownloads.has(key)) {
      return taskPromise;
    }

    taskPromise.catch(error => console.error('下载任务执行失败:', error));
    return { success: true, message: '下载任务已添加' };
  });

  ipcMain.handle('pause-download', async (event, avid, cid) => {
    const task = activeDownloads.get(`${avid}-${cid}`);
    if (!task?.control) {
      return { success: false, message: '当前下载阶段暂不支持暂停' };
    }

    try {
      await task.control.pause();
      await updateDownloadingTask(avid, cid, { status: 'paused' });
      return { success: true };
    } catch (error) {
      console.error('暂停下载失败:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('resume-download', async (event, downloadItem) => {
    const { avid, cid } = downloadItem;
    const task = activeDownloads.get(`${avid}-${cid}`);

    if (task) {
      if (!task.control) {
        return { success: false, message: '下载正在切换阶段，请稍后继续' };
      }

      try {
        await task.control.resume();
        await updateDownloadingTask(avid, cid, { status: 'downloading' });
        return { success: true };
      } catch (error) {
        console.error('继续下载失败:', error);
        return { success: false, message: error.message };
      }
    }

    const taskPromise = startDownload(downloadItem);
    if (!activeDownloads.has(`${avid}-${cid}`)) {
      return taskPromise;
    }
    taskPromise.catch(error => console.error('恢复下载任务失败:', error));
    return { success: true, message: '已继续下载' };
  });

  ipcMain.handle('cancel-download', async (event, avid, cid) => {
    const key = `${avid}-${cid}`;
    const task = activeDownloads.get(key);

    if (!task) {
      const tasks = await getDownloadingTasks();
      return tasks.some(item => item.avid === avid && item.cid === cid)
        ? { success: true }
        : { success: false, message: '未找到下载任务' };
    }

    if (!task.control) {
      return { success: false, message: '当前下载阶段无法取消，请稍后重试' };
    }

    try {
      await task.control.cancel();
      return { success: true };
    } catch (error) {
      console.error('取消下载失败:', error);
      return { success: false, message: error.message };
    }
  });

  try {
    const interruptedTasks = await getDownloadingTasks();
    await Promise.all(interruptedTasks
      .filter(task => ['downloading', 'merging', 'converting'].includes(task.status))
      .map(task => updateDownloadingTask(task.avid, task.cid, { status: 'paused' })));
  } catch (error) {
    console.error('恢复未完成下载任务状态失败:', error);
  }
}

async function startDownload(item) {
  const {
    avid,
    cid,
    title,
    videoUrl,
    audioUrl,
    picUrl,
    isCompilations,
    videoName,
    type
  } = item;
  const audioFormat = ['flac', 'dolby'].includes(item.audioFormat) ? item.audioFormat : 'mp3';
  const downloadType = type || 'video';
  const isVideoCollection = isCompilations === true;
  const collectionName = videoName || '';
  const key = `${avid}-${cid}`;

  if (activeDownloads.has(key)) {
    return { success: false, message: '该任务已在下载队列中' };
  }

  let downloadDir = getDownloadDir();
  if (isVideoCollection) {
    downloadDir = path.join(downloadDir, sanitizeFileName(collectionName));
  }
  fs.mkdirSync(downloadDir, { recursive: true });

  const safeTitle = sanitizeFileName(title);
  const completedParts = new Set(item.completedParts || []);
  const taskState = {
    control: null,
    progress: item.progress || 0
  };
  activeDownloads.set(key, taskState);

  let outputFilePath;
  let completionData;
  const cleanupAfterCompletion = [];

  try {
    if (downloadType === 'audio') {
      if (!audioUrl) throw new Error('音频URL不能为空');

      const tempAudioPath = path.resolve(downloadDir, `${safeTitle}.m4s`);
      cleanupAfterCompletion.push(tempAudioPath);
      const audioExtension = audioFormat === 'flac' ? 'flac' : audioFormat === 'dolby' ? 'mka' : 'mp3';
      outputFilePath = path.resolve(downloadDir, `${safeTitle}.${audioExtension}`);
      await addDownloadingTask({
        ...item,
        avid,
        cid,
        title,
        audioUrl,
        outputFilePath,
        completedParts: [...completedParts],
        downloadPhase: item.downloadPhase || 'audio',
        progress: item.progress || 0,
        status: 'downloading',
        type: 'audio'
      });

      if (!completedParts.has('audio')) {
        await updateDownloadingTask(avid, cid, { downloadPhase: 'audio', status: 'downloading' });
        await downloadFile(audioUrl, tempAudioPath, progress => {
          return updateDownloadProgress(avid, cid, progress * 0.6);
        }, control => { taskState.control = control; });
        completedParts.add('audio');
        await updateDownloadingTask(avid, cid, {
          completedParts: [...completedParts],
          downloadPhase: 'converting',
          status: 'converting'
        });
      }

      await updateDownloadingTask(avid, cid, { downloadPhase: 'converting', status: 'converting' });
      const convertProgress = createProgressUpdater(avid, cid, 60, 0.4);
      const processAudio = audioFormat === 'mp3' ? convertToMp3 : remuxAudio;
      await processAudio(tempAudioPath, outputFilePath, progress => {
        convertProgress.onProgress(progress);
      });
      await convertProgress.flush();
      completionData = { outputFilePath, status: 'completed', type: 'audio' };
    } else if (downloadType === 'cover') {
      if (!picUrl) throw new Error('封面URL不能为空');

      outputFilePath = path.resolve(downloadDir, `${safeTitle}.jpg`);
      await addDownloadingTask({
        ...item,
        avid,
        cid,
        title,
        picUrl,
        outputFilePath,
        completedParts: [...completedParts],
        downloadPhase: 'cover',
        progress: item.progress || 0,
        status: 'downloading',
        type: 'cover'
      });

      if (!completedParts.has('cover')) {
        await downloadFile(picUrl, outputFilePath, progress => {
          return updateDownloadProgress(avid, cid, progress);
        }, control => { taskState.control = control; });
        completedParts.add('cover');
        await updateDownloadingTask(avid, cid, { completedParts: [...completedParts] });
      }

      completionData = { outputFilePath, status: 'completed', type: 'cover' };
    } else {
      if (!videoUrl || !audioUrl) throw new Error('视频URL和音频URL不能为空');

      const videoFilePath = path.resolve(downloadDir, `${safeTitle}_video.m4s`);
      const audioFilePath = path.resolve(downloadDir, `${safeTitle}_audio.m4s`);
      cleanupAfterCompletion.push(videoFilePath, audioFilePath);
      outputFilePath = path.resolve(downloadDir, `${safeTitle}.${audioFormat === 'mp3' ? 'mp4' : 'mkv'}`);
      await addDownloadingTask({
        ...item,
        avid,
        cid,
        title,
        videoUrl,
        audioUrl,
        isCompilations: isVideoCollection,
        videoName: collectionName,
        outputFilePath,
        completedParts: [...completedParts],
        downloadPhase: item.downloadPhase || 'video',
        progress: item.progress || 0,
        status: 'downloading',
        type: downloadType
      });

      if (!completedParts.has('video')) {
        await updateDownloadingTask(avid, cid, { downloadPhase: 'video', status: 'downloading' });
        await downloadFile(videoUrl, videoFilePath, progress => {
          return updateDownloadProgress(avid, cid, progress * 0.4);
        }, control => { taskState.control = control; });
        completedParts.add('video');
        await updateDownloadingTask(avid, cid, {
          completedParts: [...completedParts],
          downloadPhase: 'audio'
        });
      }

      if (!completedParts.has('audio')) {
        await updateDownloadingTask(avid, cid, { downloadPhase: 'audio', status: 'downloading' });
        await downloadFile(audioUrl, audioFilePath, progress => {
          return updateDownloadProgress(avid, cid, 40 + progress * 0.4);
        }, control => { taskState.control = control; });
        completedParts.add('audio');
        await updateDownloadingTask(avid, cid, {
          completedParts: [...completedParts],
          downloadPhase: 'merging'
        });
      }

      await updateDownloadingTask(avid, cid, { downloadPhase: 'merging', status: 'merging' });
      const mergeProgress = createProgressUpdater(avid, cid, 80, 0.2);
      await mergeVideoAudio(videoFilePath, audioFilePath, outputFilePath, progress => {
        mergeProgress.onProgress(progress);
      }, audioFormat);
      await mergeProgress.flush();
      completionData = {
        outputFilePath,
        status: 'completed',
        type: downloadType,
        isCompilations: isVideoCollection,
        videoName: collectionName
      };
    }

    await updateDownloadProgress(avid, cid, 100);
    await moveTaskToCompleted(avid, cid, completionData);
    await Promise.all(cleanupAfterCompletion.map(deleteFile));
    activeDownloads.delete(key);

    return {
      success: true,
      outputFilePath,
      coverPath: downloadType === 'cover' ? outputFilePath : null
    };
  } catch (error) {
    console.error(`下载失败 [${title}]:`, error);

    if (error.code === 'DOWNLOAD_CANCELLED') {
      await Promise.all(cleanupAfterCompletion.map(deleteFile));
    } else {
      await updateDownloadingTask(avid, cid, {
        status: 'failed',
        error: error.message
      });
    }

    activeDownloads.delete(key);
    return {
      success: false,
      cancelled: error.code === 'DOWNLOAD_CANCELLED',
      error: error.message
    };
  }
}

async function updateDownloadProgress(avid, cid, progress) {
  const key = `${avid}-${cid}`;
  const roundedProgress = Math.round(progress);
  const task = activeDownloads.get(key);
  if (task) {
    if (task.progress === roundedProgress) return;
    task.progress = roundedProgress;
  }

  await updateDownloadingTask(avid, cid, {
    progress: roundedProgress
  });
}

function createProgressUpdater(avid, cid, offset, scale) {
  let lastProgress = null;
  let pendingUpdate = Promise.resolve();

  return {
    onProgress(progress) {
      const nextProgress = Math.round(offset + progress * scale);
      if (nextProgress === lastProgress) return;
      lastProgress = nextProgress;
      pendingUpdate = pendingUpdate.then(() => updateDownloadProgress(avid, cid, nextProgress));
    },
    flush() {
      return pendingUpdate;
    }
  };
}

function sanitizeFileName(filename) {
  if (!filename) return 'unnamed';

  let normalizedName = String(filename);
  if (/\uFFFD|銆/.test(normalizedName)) {
    normalizedName = normalizedName.replace(/銆|€|鈥爓/g, '');
  }

  return normalizedName
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'unnamed';
}
