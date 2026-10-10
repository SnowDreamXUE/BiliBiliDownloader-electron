import { app } from 'electron';
import { spawn } from 'child_process';
import http from 'http';
import net from 'net';
import path from 'path';
import fs from 'fs';
import { randomBytes } from 'crypto';

// 工具路径配置
const NODE_ENV = process.env.NODE_ENV || 'production';
const aria2cPath = "/assets/aria2c.exe";
const ffmpegPath = "/assets/ffmpeg.exe";

const getResourcePath = () => {
  const resourcePath = app.getAppPath();
  if (NODE_ENV !== 'development') {
    return process.resourcesPath;
  }
  return resourcePath;
}

const getFfmpegPath = () => {
  return path.join(getResourcePath(), ffmpegPath);
}

const getAria2cPath = () => {
  return path.join(getResourcePath(), aria2cPath);
}

// 默认下载目录
let defaultDownloadDir = path.join(app.getPath('downloads'), 'BiliBiliDownloader');

// 确保下载目录存在
function ensureDownloadDirExists(dirPath = defaultDownloadDir) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

// 设置下载目录
export function setDownloadDir(dirPath) {
  defaultDownloadDir = dirPath;
  ensureDownloadDirExists(defaultDownloadDir);
  return defaultDownloadDir;
}

// 获取当前下载目录
export function getDownloadDir() {
  return defaultDownloadDir;
}

// 将文件从源位置移动到目标位置
function moveFile(sourcePath, targetPath) {
  return new Promise((resolve, reject) => {
    try {
      // 确保目标目录存在
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // 尝试直接重命名(移动)文件
      fs.rename(sourcePath, targetPath, (err) => {
        if (err) {
          // 如果重命名失败(可能是跨磁盘)，尝试复制+删除
          const readStream = fs.createReadStream(sourcePath);
          const writeStream = fs.createWriteStream(targetPath);

          readStream.on('error', reject);
          writeStream.on('error', reject);

          writeStream.on('finish', () => {
            // 复制完成后删除源文件
            fs.unlink(sourcePath, (unlinkErr) => {
              if (unlinkErr) {
                console.warn('无法删除临时文件:', unlinkErr);
              }
              resolve();
            });
          });

          // 进行数据传输
          readStream.pipe(writeStream);
        } else {
          // 重命名成功
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function callAria2Rpc(port, secret, method, params = []) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: randomBytes(8).toString('hex'),
      method: `aria2.${method}`,
      params: [`token:${secret}`, ...params]
    });

    const request = http.request({
      host: '127.0.0.1',
      port,
      path: '/jsonrpc',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, response => {
      let responseBody = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { responseBody += chunk; });
      response.on('end', () => {
        try {
          const result = JSON.parse(responseBody);
          if (result.error) {
            reject(new Error(result.error.message || 'aria2 RPC 请求失败'));
          } else {
            resolve(result.result);
          }
        } catch (error) {
          reject(new Error(`解析 aria2 RPC 响应失败: ${error.message}`));
        }
      });
    });

    request.setTimeout(3000, () => request.destroy(new Error('aria2 RPC 请求超时')));
    request.once('error', reject);
    request.end(body);
  });
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function waitForAria2(aria2c, port, secret, getSpawnError) {
  const deadline = Date.now() + 10000;
  let lastError;

  while (Date.now() < deadline) {
    const spawnError = getSpawnError();
    if (spawnError) {
      throw new Error(`启动 aria2c 失败: ${spawnError.message}`);
    }
    if (aria2c.exitCode !== null) {
      throw new Error(`aria2c 提前退出，退出码: ${aria2c.exitCode}`);
    }

    try {
      await callAria2Rpc(port, secret, 'getVersion');
      return;
    } catch (error) {
      lastError = error;
      await wait(150);
    }
  }

  throw new Error(`等待 aria2 RPC 启动超时: ${lastError?.message || '未知错误'}`);
}

async function stopAria2(aria2c, port, secret) {
  if (aria2c.exitCode !== null || aria2c.signalCode !== null) return;

  const closed = new Promise(resolve => {
    if (aria2c.exitCode !== null || aria2c.signalCode !== null) {
      resolve();
    } else {
      aria2c.once('close', resolve);
    }
  });

  try {
    await callAria2Rpc(port, secret, 'shutdown');
  } catch {
    aria2c.kill();
  }

  await Promise.race([
    closed,
    wait(1500)
  ]);

  if (aria2c.exitCode === null && aria2c.signalCode === null) {
    aria2c.kill();
  }
}

function createDownloadError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * 使用 aria2c 的本地 RPC 下载文件，暂停时保留 aria2 分片和控制文件以便继续。
 * @param {string} url 下载链接
 * @param {string} finalPath 最终保存路径
 * @param {function} progressCallback 进度回调函数
 * @param {function} controlCallback 接收暂停、继续和取消控制对象
 * @returns {Promise<object>} 下载结果
 */
export async function downloadFile(url, finalPath, progressCallback = null, controlCallback = null) {
  const finalDir = path.dirname(finalPath);
  ensureDownloadDirExists(finalDir);

  const partialPath = `${finalPath}.part`;
  const partialName = path.basename(partialPath);
  const port = await getAvailablePort();
  const secret = randomBytes(24).toString('hex');
  const aria2c = spawn(getAria2cPath(), [
    '--no-conf=true',
    '--enable-rpc=true',
    '--rpc-listen-all=false',
    `--rpc-listen-port=${port}`,
    `--rpc-secret=${secret}`,
    '--console-log-level=warn',
    '--file-allocation=none',
    '--continue=true',
    '--allow-overwrite=true',
    '--auto-file-renaming=false',
    `--stop-with-process=${process.pid}`,
    '--header=User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    '--header=Referer: https://www.bilibili.com/'
  ], { windowsHide: true, stdio: 'ignore' });
  aria2c.unref();
  let spawnError;
  aria2c.on('error', error => { spawnError = error; });

  let gid;
  let cancelled = false;
  let lastProgressUpdate = 0;
  const control = {
    pause: async () => {
      if (gid) await callAria2Rpc(port, secret, 'pause', [gid]);
    },
    resume: async () => {
      if (gid) await callAria2Rpc(port, secret, 'unpause', [gid]);
    },
    cancel: async () => {
      cancelled = true;
      if (gid) {
        try {
          await callAria2Rpc(port, secret, 'forceRemove', [gid]);
        } catch {
          // 下载可能已经结束，仍然继续清理本地分片。
        }
      }
    }
  };

  try {
    await waitForAria2(aria2c, port, secret, () => spawnError);
    gid = await callAria2Rpc(port, secret, 'addUri', [[url], {
      dir: finalDir,
      out: partialName,
      'max-connection-per-server': '16',
      split: '16',
      'min-split-size': '1M',
      'continue': 'true',
      'allow-overwrite': 'true',
      'auto-file-renaming': 'false'
    }]);
    if (controlCallback) controlCallback(control);

    while (true) {
      await wait(500);
      if (cancelled) {
        throw createDownloadError('下载已取消', 'DOWNLOAD_CANCELLED');
      }

      const status = await callAria2Rpc(port, secret, 'tellStatus', [gid, [
        'status', 'totalLength', 'completedLength', 'errorMessage'
      ]]);

      const totalLength = Number(status.totalLength);
      const completedLength = Number(status.completedLength);
      if (progressCallback && totalLength > 0 && Date.now() - lastProgressUpdate >= 1000) {
        await progressCallback(Math.min(99, (completedLength / totalLength) * 100));
        lastProgressUpdate = Date.now();
      }

      if (status.status === 'complete') break;
      if (status.status === 'error') {
        throw new Error(`aria2c 下载失败: ${status.errorMessage || '未知错误'}`);
      }
      if (status.status === 'removed') {
        throw createDownloadError('下载已取消', 'DOWNLOAD_CANCELLED');
      }
    }

    await stopAria2(aria2c, port, secret);
    await moveFile(partialPath, finalPath);
    if (progressCallback) await progressCallback(100);

    return { success: true, filePath: finalPath, progress: 100 };
  } catch (error) {
    await stopAria2(aria2c, port, secret);

    if (cancelled) {
      await Promise.all([
        deleteFile(partialPath),
        deleteFile(`${partialPath}.aria2`)
      ]);
      throw createDownloadError('下载已取消', 'DOWNLOAD_CANCELLED');
    }

    throw error;
  } finally {
    if (controlCallback) controlCallback(null);
  }
}

/**
 * 使用ffmpeg合并视频和音频
 * @param {string} videoPath 视频文件路径
 * @param {string} audioPath 音频文件路径
 * @param {string} outputPath 输出文件路径
 * @param {function} progressCallback 进度回调函数
 * @returns {Promise<object>} 合并结果
 */
export function mergeVideoAudio(videoPath, audioPath, outputPath, progressCallback = null) {
  return new Promise((resolve, reject) => {
    // 确保输出目录存在
    const dir = path.dirname(outputPath);
    ensureDownloadDirExists(dir);

    // ffmpeg参数
    const args = [
      '-i', videoPath,
      '-i', audioPath,
      '-c:v', 'copy',      // 复制视频流，不重新编码
      '-c:a', 'aac',       // 使用aac作为音频编码
      '-strict', 'experimental',
      '-y',                // 自动覆盖输出文件
      outputPath
    ];

    console.log('执行ffmpeg合并，命令:', getFfmpegPath(), args.join(' '));

    const ffmpeg = spawn(getFfmpegPath(), args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });

    let error = '';
    let duration = 0;
    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString();
      error = `${error}${output}`.slice(-2000);

      // 尝试解析总时长
      const durationMatch = output.match(/Duration: ([0-9]+):([0-9]+):([0-9]+)/);
      if (durationMatch) {
        const hours = parseInt(durationMatch[1]);
        const minutes = parseInt(durationMatch[2]);
        const seconds = parseInt(durationMatch[3]);
        duration = hours * 3600 + minutes * 60 + seconds;
      }

      // 尝试解析当前处理进度
      const timeMatch = output.match(/time=([0-9]+):([0-9]+):([0-9]+)/);
      if (timeMatch && progressCallback && duration > 0) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const seconds = parseInt(timeMatch[3]);
        const currentTime = hours * 3600 + minutes * 60 + seconds;
        const progress = Math.min(Math.round((currentTime / duration) * 100), 100);
        progressCallback(progress);
      }
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          outputPath: outputPath
        });
      } else {
        reject(new Error(`ffmpeg 合并失败，退出码: ${code}, 错误: ${error}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`启动 ffmpeg 失败: ${err.message}`));
    });
  });
}

/**
 * 使用ffmpeg将音频文件转换为MP3格式
 * @param {string} inputPath 输入音频文件路径
 * @param {string} outputPath 输出MP3文件路径
 * @param {function} progressCallback 进度回调函数
 * @returns {Promise<object>} 转换结果
 */
export function convertToMp3(inputPath, outputPath, progressCallback = null) {
  return new Promise((resolve, reject) => {
    // 确保输出目录存在
    const dir = path.dirname(outputPath);
    ensureDownloadDirExists(dir);

    // ffmpeg参数
    const args = [
      '-i', inputPath,
      '-c:a', 'libmp3lame',  // 使用MP3编码器
      '-q:a', '2',           // 音质设置（2是较高质量，范围0-9）
      '-y',                  // 自动覆盖输出文件
      outputPath
    ];

    console.log('执行ffmpeg转换MP3，命令:', getFfmpegPath(), args.join(' '));

    const ffmpeg = spawn(getFfmpegPath(), args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });

    let error = '';
    let duration = 0;
    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString();
      error = `${error}${output}`.slice(-2000);

      // 尝试解析总时长
      const durationMatch = output.match(/Duration: ([0-9]+):([0-9]+):([0-9]+)/);
      if (durationMatch) {
        const hours = parseInt(durationMatch[1]);
        const minutes = parseInt(durationMatch[2]);
        const seconds = parseInt(durationMatch[3]);
        duration = hours * 3600 + minutes * 60 + seconds;
      }

      // 尝试解析当前处理进度
      const timeMatch = output.match(/time=([0-9]+):([0-9]+):([0-9]+)/);
      if (timeMatch && progressCallback && duration > 0) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const seconds = parseInt(timeMatch[3]);
        const currentTime = hours * 3600 + minutes * 60 + seconds;
        const progress = Math.min(Math.round((currentTime / duration) * 100), 100);
        progressCallback(progress);
      }
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          outputPath: outputPath
        });
      } else {
        reject(new Error(`ffmpeg MP3转换失败，退出码: ${code}, 错误: ${error}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`启动 ffmpeg 失败: ${err.message}`));
    });
  });
}

/**
 * 删除文件
 * @param {string} filePath 文件路径
 * @returns {Promise<boolean>} 是否成功删除
 */
export function deleteFile(filePath) {
  return new Promise((resolve) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      resolve(true);
    } catch (error) {
      console.error(`删除文件失败 ${filePath}:`, error);
      resolve(false);
    }
  });
}
