import { app } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os'; // 用于获取系统临时目录

// 工具路径配置
const isDev = process.env.NODE_ENV === 'development';
let basePath;

if (isDev) {
  // 开发环境
  basePath = path.resolve(process.cwd(), 'resources/tools');
} else {
  // 生产环境
  basePath = path.join(process.resourcesPath, 'tools');
}

const ARIA2C_PATH = path.join(basePath, 'aria2c.exe');
const FFMPEG_PATH = path.join(basePath, 'ffmpeg.exe');

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

/**
 * 使用aria2c下载文件到临时目录，然后移动到最终位置
 * @param {string} url 下载链接
 * @param {string} finalPath 最终保存路径
 * @param {function} progressCallback 进度回调函数
 * @returns {Promise<object>} 下载结果
 */
export function downloadFile(url, finalPath, progressCallback = null) {
  return new Promise(async (resolve, reject) => {
    // 创建一个临时文件名，避免所有路径问题
    const tempDir = os.tmpdir();
    const tempFileName = `bili_temp_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.tmp`;
    const tempFilePath = path.join(tempDir, tempFileName);

    console.log('下载文件到临时路径:', tempFilePath);
    console.log('最终目标路径:', finalPath);

    // 确保目标目录存在
    try {
      const finalDir = path.dirname(finalPath);
      if (!fs.existsSync(finalDir)) {
        fs.mkdirSync(finalDir, { recursive: true });
        console.log('已创建目标目录:', finalDir);
      }
    } catch (dirError) {
      console.error('创建目标目录失败:', dirError);
      reject(new Error(`创建目标目录失败: ${dirError.message}`));
      return;
    }

    try {
      // aria2c参数
      const args = [
        url,
        `--dir=${tempDir}`,          // 设置下载目录
        `--out=${tempFileName}`,     // 设置输出文件名，不是完整路径
        '--max-connection-per-server=16',
        '--split=16',
        '--min-split-size=1M',
        '--console-log-level=notice',
        '--download-result=full',
        '--allow-overwrite=true'     // 允许覆盖已存在文件
      ];

      // 添加用于B站的请求头
      args.push('--header=User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      args.push('--header=Referer: https://www.bilibili.com/');

      console.log('执行aria2c下载，命令:', ARIA2C_PATH, args.join(' '));

      const aria2c = spawn(ARIA2C_PATH, args);

      let lastProgress = 0;
      let error = '';

      aria2c.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('aria2c stdout:', output);

        // 解析下载进度
        if (progressCallback) {
          const progressMatch = output.match(/\(([0-9.]+)%\)/);
          if (progressMatch && progressMatch[1]) {
            const progress = parseFloat(progressMatch[1]);
            if (progress > lastProgress) {
              lastProgress = progress;
              progressCallback(progress);
            }
          }
        }
      });

      aria2c.stderr.on('data', (data) => {
        error += data.toString();
        console.error('aria2c stderr:', data.toString());
      });

      aria2c.on('close', async (code) => {
        if (code === 0) {
          try {
            // 下载成功，现在将文件从临时目录移动到最终位置
            await moveFile(tempFilePath, finalPath);
            console.log('成功将文件从临时目录移动到:', finalPath);
            resolve({
              success: true,
              filePath: finalPath,
              progress: 100
            });
          } catch (moveError) {
            console.error('移动文件失败:', moveError);
            reject(new Error(`移动文件失败: ${moveError.message}`));
          }
        } else {
          reject(new Error(`aria2c 下载失败，退出码: ${code}, 错误: ${error}`));
        }
      });

      aria2c.on('error', (err) => {
        reject(new Error(`启动 aria2c 失败: ${err.message}`));
      });
    } catch (error) {
      console.error('下载过程出错:', error);
      reject(error);
    }
  });
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

    console.log('执行ffmpeg合并，命令:', FFMPEG_PATH, args.join(' '));

    const ffmpeg = spawn(FFMPEG_PATH, args);

    let error = '';
    let duration = 0;
    let currentTime = 0;

    ffmpeg.stdout.on('data', (data) => {
      console.log('ffmpeg stdout:', data.toString());
    });

    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString();
      console.log('ffmpeg stderr:', output);

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
        currentTime = hours * 3600 + minutes * 60 + seconds;
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

    console.log('执行ffmpeg转换MP3，命令:', FFMPEG_PATH, args.join(' '));

    const ffmpeg = spawn(FFMPEG_PATH, args);

    let error = '';
    let duration = 0;
    let currentTime = 0;

    ffmpeg.stdout.on('data', (data) => {
      console.log('ffmpeg stdout:', data.toString());
    });

    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString();
      console.log('ffmpeg stderr:', output);

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
        currentTime = hours * 3600 + minutes * 60 + seconds;
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
 * 下载封面图片
 * @param {string} url 图片URL
 * @param {string} outputPath 保存路径
 * @param {function} progressCallback 进度回调
 * @returns {Promise<object>} 下载结果
 */
export function downloadCover(url, outputPath, progressCallback = null) {
  return downloadFile(url, outputPath, progressCallback);
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
