import { app, dialog, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { downloadFile, mergeVideoAudio, downloadCover, deleteFile, setDownloadDir, getDownloadDir,convertToMp3 } from './downloadTools';
import { addDownloadingTask, updateDownloadingTask, moveTaskToCompleted } from './dataStorage';

// 正在进行的下载任务
const activeDownloads = new Map();

// 初始化下载管理器
export function initDownloadManager() {
  // 选择下载目录
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

  // 获取当前下载目录
  ipcMain.handle('get-download-directory', () => {
    return getDownloadDir();
  });

  // 开始下载
  ipcMain.handle('start-download', async (event, downloadItem) => {
    try {
      // 先将任务添加到下载队列
      const result = { success: true, message: '下载任务已添加' };

      // 异步启动下载任务，不等待其完成
      startDownload(downloadItem).catch(error => {
        console.error('下载任务执行失败:', error);
      });

      // 立即返回成功结果
      return result;
    } catch (error) {
      console.error('添加下载任务失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 取消下载
  ipcMain.handle('cancel-download', async (event, avid, cid) => {
    try {
      const key = `${avid}-${cid}`;
      if (activeDownloads.has(key)) {
        const task = activeDownloads.get(key);
        if (task.controller) {
          task.controller.abort();
        }
        activeDownloads.delete(key);
        return { success: true };
      }
      return { success: false, message: '未找到下载任务' };
    } catch (error) {
      console.error('取消下载失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 批量下载
  ipcMain.handle('batch-download', async (event, items) => {
    try {
      const results = [];
      for (const item of items) {
        const result = await startDownload(item);
        results.push(result);
      }
      return { success: true, results };
    } catch (error) {
      console.error('批量下载失败:', error);
      return { success: false, error: error.message };
    }
  });
}

/**
 * 开始下载任务
 * @param {object} item 下载项
 * @returns {Promise<object>} 下载结果
 */
async function startDownload(item) {
  const { avid, cid, title, videoUrl, audioUrl, picUrl, isCompilations, videoName, type } = item;

  // 确保这些字段是确定的（非undefined）
  const isVideoCollection = isCompilations === true;
  const collectionName = videoName || '';

  console.log('开始下载任务:', {
    avid, cid, title, type,
    isCompilations: isVideoCollection,
    videoName: collectionName
  });

  // 判断是否已在下载队列
  const key = `${avid}-${cid}`;
  if (activeDownloads.has(key)) {
    return { success: false, message: '该任务已在下载队列中' };
  }

  // 构建下载路径 - 确保是绝对路径
  let downloadDir = getDownloadDir();
  console.log('基础下载目录:', downloadDir);

  if (isVideoCollection) {
    // 合集视频，创建以合集名称命名的文件夹
    downloadDir = path.join(downloadDir, sanitizeFileName(collectionName));
    console.log('合集下载目录:', downloadDir);
  }
  // 确保下载目录存在
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  // 文件名处理（去除非法字符）
  const safeTitle = sanitizeFileName(title);

  // 创建AbortController用于取消下载
  const controller = new AbortController();

  // 添加到活跃下载列表
  activeDownloads.set(key, { controller, progress: 0 });

  // 提前声明所有需要的路径变量，使用let而不是const
  let outputFilePath;  // 修改为let声明
  let videoFilePath;
  let audioFilePath;
  let coverFilePath = picUrl ? path.resolve(downloadDir, `${safeTitle}.jpg`) : null;

  try {
    // 根据不同的下载类型执行不同的下载流程
    switch (type) {
      case 'audio':
        // 仅下载音频
        if (!audioUrl) {
          throw new Error('音频URL不能为空');
        }

        // 临时m4s音频文件路径
        const tempAudioPath = path.resolve(downloadDir, `${safeTitle}.m4s`);

        // 设置最终MP3输出路径
        outputFilePath = path.resolve(downloadDir, `${safeTitle}.mp3`);
        console.log('音频输出路径:', outputFilePath);

        // 添加到下载中任务
        await addDownloadingTask({
          avid,
          cid,
          title,
          audioUrl,
          outputFilePath,
          progress: 0,
          status: 'downloading',
          type: 'audio'
        });

        // 下载音频 (m4s格式)
        await downloadFile(audioUrl, tempAudioPath, (progress) => {
          updateDownloadProgress(avid, cid, progress * 0.6); // 占总进度的60%
        });

        // 更新状态为转换中
        await updateDownloadingTask(avid, cid, {
          status: 'converting',
          progress: 60
        });

        // 转换为MP3格式
        await convertToMp3(tempAudioPath, outputFilePath, (progress) => {
          updateDownloadProgress(avid, cid, 60 + progress * 0.4); // 占总进度的40%
        });

        // 删除临时m4s文件
        await deleteFile(tempAudioPath);

        // 移动到已完成
        await moveTaskToCompleted(avid, cid, {
          outputFilePath,
          status: 'completed',
          type: 'audio'
        });
        break;

      case 'cover':
        // 仅下载封面
        if (!picUrl) {
          throw new Error('封面URL不能为空');
        }

        outputFilePath = coverFilePath; // 设置输出路径为封面路径

        // 添加到下载中任务
        await addDownloadingTask({
          avid,
          cid,
          title,
          picUrl,
          outputFilePath,
          progress: 0,
          status: 'downloading',
          type: 'cover'
        });

        // 下载封面
        await downloadCover(picUrl, outputFilePath, (progress) => {
          updateDownloadProgress(avid, cid, progress);
        });

        // 移动到已完成
        await moveTaskToCompleted(avid, cid, {
          outputFilePath,
          status: 'completed',
          type: 'cover'
        });
        break;

      default:
        // 默认下载完整视频（视频+音频）
        if (!videoUrl || !audioUrl) {
          throw new Error('视频URL和音频URL不能为空');
        }

        // 文件路径
        videoFilePath = path.resolve(downloadDir, `${safeTitle}_video.m4s`);
        audioFilePath = path.resolve(downloadDir, `${safeTitle}_audio.m4s`);
        outputFilePath = path.resolve(downloadDir, `${safeTitle}.mp4`);

        // 添加到下载中任务
        await addDownloadingTask({
          avid,
          cid,
          title,
          videoUrl,
          audioUrl,
          isCompilations: isVideoCollection,
          videoName: collectionName,
          outputFilePath,
          progress: 0,
          status: 'downloading',
          type: type || 'video' // 默认为视频类型
        });

        // 1. 下载视频
        await downloadFile(videoUrl, videoFilePath, (progress) => {
          updateDownloadProgress(avid, cid, progress * 0.4); // 占总进度的40%
        });

        // 2. 下载音频
        await downloadFile(audioUrl, audioFilePath, (progress) => {
          updateDownloadProgress(avid, cid, 40 + progress * 0.4); // 占总进度的40%
        });

        // 更新状态为合并中
        await updateDownloadingTask(avid, cid, { status: 'merging' });

        // 3. 合并音视频
        await mergeVideoAudio(videoFilePath, audioFilePath, outputFilePath, (progress) => {
          updateDownloadProgress(avid, cid, 80 + progress * 0.2); // 占总进度的20%
        });

        // 5. 清理临时文件
        await Promise.all([
          deleteFile(videoFilePath),
          deleteFile(audioFilePath)
        ]);

        // 移动到已完成
        await moveTaskToCompleted(avid, cid, {
          outputFilePath,
          status: 'completed',
          type: type || 'video',
          isCompilations: isVideoCollection,
          videoName: collectionName
        });
        break;
    }

    // 更新进度到100%
    await updateDownloadProgress(avid, cid, 100);

    // 从活跃下载移除
    activeDownloads.delete(key);

    return {
      success: true,
      outputFilePath,
      coverPath: type === 'cover' ? outputFilePath : null
    };

  } catch (error) {
    console.error(`下载失败 [${title}]:`, error);

    // 更新失败状态
    await updateDownloadingTask(avid, cid, {
      status: 'failed',
      error: error.message
    });

    // 从活跃下载移除
    activeDownloads.delete(key);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 更新下载进度
 * @param {string|number} avid 视频ID
 * @param {string|number} cid 分P ID
 * @param {number} progress 进度值（0-100）
 */
async function updateDownloadProgress(avid, cid, progress) {
  // 更新内存中的进度
  const key = `${avid}-${cid}`;
  if (activeDownloads.has(key)) {
    activeDownloads.get(key).progress = progress;
  }

  // 更新数据库中的进度
  await updateDownloadingTask(avid, cid, {
    progress: Math.round(progress)
  });
}

/**
 * 清理文件名中的非法字符
 * @param {string} filename 原始文件名
 * @returns {string} 处理后的文件名
 */
function sanitizeFileName(filename) {
  if (!filename) return 'unnamed';

  // 处理文本可能的编码问题
  try {
    // 尝试检测是否有乱码
    if (/\uFFFD/.test(filename) || /銆/.test(filename)) {
      // 如果检测到乱码字符，尝试简单替换
      filename = filename.replace(/銆|€|鈥爓/g, '');
    }
  } catch (e) {
    console.error('处理文件名编码错误:', e);
  }

  return filename
    .replace(/[\\/:*?"<>|]/g, '_') // 替换Windows下的非法字符
    .replace(/\s+/g, ' ')          // 多个空格替换为单个
    .trim();                        // 移除首尾空格
}
