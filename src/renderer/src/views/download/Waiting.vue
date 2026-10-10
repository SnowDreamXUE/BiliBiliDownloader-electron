<template>
  <div class="waiting-view">
    <header class="waiting-toolbar">
      <div class="path-setting">
        <el-button
          class="path-button"
          @click="selectDownloadPath"
        >
          <el-icon><FolderOpened /></el-icon>
          <span>选择保存目录</span>
        </el-button>
        <span class="path-value" :title="downloadPath || '未设置'">
          {{ downloadPath || "未设置" }}
        </span>
      </div>
      <div v-if="downloadInfo.length" class="download-action">
        <el-button type="primary" @click="downloadAll">全部下载</el-button>
        <el-button class="clear-button" @click="clearAll">清空</el-button>
      </div>
    </header>

    <div v-if="downloadInfo.length === 0" class="empty-state">
      <h3>暂无待下载内容</h3>
      <el-button type="primary" plain @click="$router.push('/search')">解析视频</el-button>
    </div>

    <div v-else class="download-info">
      <div v-for="(video, videoIndex) in downloadInfo" :key="'video-'+videoIndex" class="download-page">
        <div v-for="item in video.pages" :key="item.cid" class="download-item">
          <div class="video-pic">
            <img :src="item.pic" alt="视频封面" />
          </div>
          <div class="video-info">
            <div class="download-item-top">
              <div class="video-title" :title="item.title">{{ item.title }}</div>
              <div class="video-action">
                <el-button size="small" @click="downloadCover(item)">封面</el-button>
                <el-button size="small" @click="downloadAudio(item)">音频</el-button>
                <el-button size="small" type="primary" @click="downloadVideo(item)">下载视频</el-button>
              </div>
            </div>
            <div class="video-select">
              <div class="audio-quality">
                <span class="select-span">音质</span>
                <el-select
                  v-model="selectedAudio[item.cid]"
                  class="select-quality"
                  placeholder="选择音频码率"
                  size="small"
                >
                  <el-option
                    v-for="(audio, index) in getAudioOptions(item)"
                    :key="'audio-'+item.cid+'-'+audio.audioId+'-'+index"
                    :label="audio.label"
                    :value="audio.url"
                    :disabled="audio.disabled"
                  ></el-option>
                </el-select>
              </div>
              <div class="video-quality">
                <span class="select-span">画质</span>
                <el-select
                  v-model="selectedVideo[item.cid]"
                  class="select-quality"
                  placeholder="选择清晰度"
                  size="small"
                >
                  <el-option
                    v-for="(video, index) in getVideoOptions(item)"
                    :key="'video-'+item.cid+'-'+video.qualityId+'-'+video.codecId+'-'+index"
                    :label="video.label"
                    :value="video.url"
                    :disabled="video.disabled"
                  ></el-option>
                </el-select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  AUDIO_OPTIONS,
  loadDownloadConfig,
  QUALITY_OPTIONS,
  selectDefaultAudio,
  selectDefaultVideo
} from "../../utils/downloadConfig";

export default {
  data() {
    return {
      downloadInfo: [], // 下载信息
      selectedVideo: {}, // 存储选中的视频质量
      selectedAudio: {}, // 存储选中的音频质量
      downloadConfig: loadDownloadConfig(),
      downloadPath: "" // 下载路径
    };
  },

  mounted() {
    this.init();
    this.getDownloadDirectory();
  },

  methods: {
    // 从JSON中获取数据
    async init() {
      try {
        this.downloadInfo = await window.api.storage.getDownloadsInfo();

        // 初始化默认选中的音视频
        this.downloadInfo.forEach(video => {
          video.pages.forEach(page => {
            if (page.videoData && page.videoData.length > 0) {
              const preferredVideo = selectDefaultVideo(page.videoData, this.downloadConfig);
              this.selectedVideo[page.cid] = preferredVideo?.url || page.videoData[0].url;
            }
            if (page.audioData && page.audioData.length > 0) {
              const preferredAudio = selectDefaultAudio(page.audioData, this.downloadConfig);
              this.selectedAudio[page.cid] = preferredAudio?.url || page.audioData[0].url;
            }
          });
        });
      } catch (error) {
        console.error("获取下载信息失败", error);
      }
    },

    // 获取当前下载目录
    async getDownloadDirectory() {
      try {
        const path = await window.api.download.getDirectory();
        this.downloadPath = path || "";
      } catch (error) {
        console.error("获取下载路径失败", error);
        this.$message.error(`获取下载路径失败: ${error.message}`);
      }
    },

    // 选择下载路径
    async selectDownloadPath() {
      try {
        const result = await window.api.download.selectDirectory();
        if (result.success) {
          this.downloadPath = result.path;
          this.$message.success(`已设置下载路径: ${result.path}`);
        }
      } catch (error) {
        console.error("选择下载路径失败", error);
        this.$message.error(`选择下载路径失败: ${error.message}`);
      }
    },

    getAudioOptions(item) {
      const streams = Array.isArray(item.audioData) ? item.audioData : [];
      const knownIds = new Set(AUDIO_OPTIONS.map(option => option.audioId));
      const options = [...AUDIO_OPTIONS].reverse().map(option => {
        const available = streams.find(stream => Number(stream.audioId) === option.audioId);
        return available || {
          label: `${option.label}（不可用）`,
          url: `unavailable-audio-${item.cid}-${option.audioId}`,
          audioId: option.audioId,
          disabled: true
        };
      });

      return options.concat(streams.filter(stream => !knownIds.has(Number(stream.audioId))));
    },

    getVideoOptions(item) {
      const streams = Array.isArray(item.videoData) ? item.videoData : [];
      const knownQualityIds = new Set(QUALITY_OPTIONS.map(option => option.qualityId));
      const acceptedQualities = new Set((item.acceptQuality || []).map(Number));
      const hasAcceptedQualityList = acceptedQualities.size > 0;
      const isStreamAvailable = stream => {
        const qualityId = Number(stream.qualityId);
        if (hasAcceptedQualityList && !acceptedQualities.has(qualityId)) return false;

        const supportFormat = (item.supportFormats || []).find(format => Number(format.qualityId) === qualityId);
        if (supportFormat?.codecs?.length && stream.codecs) {
          return supportFormat.codecs.includes(stream.codecs);
        }
        return true;
      };
      const options = [...QUALITY_OPTIONS].reverse().flatMap(option => {
        const available = streams
          .filter(stream => Number(stream.qualityId) === option.qualityId)
          .filter(isStreamAvailable);
        return available.length > 0 ? available : [{
          label: `${option.label}（不可用）`,
          url: `unavailable-video-${item.cid}-${option.qualityId}`,
          qualityId: option.qualityId,
          codecId: 0,
          disabled: true
        }];
      });

      return options.concat(streams.filter(stream =>
        !knownQualityIds.has(Number(stream.qualityId)) && isStreamAvailable(stream)
      ));
    },

    getAudioFormat(item) {
      const selectedStream = item.audioData?.find(stream => stream.url === this.selectedAudio[item.cid]);
      return selectedStream?.format || "mp3";
    },

    // 下载封面
    async downloadCover(item) {
      try {
        if (!item.pic) {
          this.$message.error("封面链接不存在");
          return;
        }

        // 找到对应的视频信息
        const videoInfo = this.downloadInfo.find(video =>
          video.pages.some(page => page.cid === item.cid)
        );

        if (!videoInfo) {
          this.$message.error("未找到对应的视频信息");
          return;
        }

        // 创建下载任务
        const downloadItem = {
          avid: videoInfo.avid,
          cid: item.cid,
          title: item.title,
          picUrl: item.pic,
          isCompilations: videoInfo.isCompilations,
          videoName: videoInfo.videoName,
          type: "cover" // 下载类型：封面
        };

        // 发送下载请求
        const result = await window.ipcRenderer.invoke("start-download", downloadItem);

        if (result.success) {
          this.$message.success("封面下载任务已添加");
          // 跳转到下载中页面
          this.$router.push("/download/downloading");
        } else {
          this.$message.error(`封面下载失败: ${result.message || result.error}`);
        }
      } catch (error) {
        console.error("下载封面失败", error);
        this.$message.error(`下载封面出错: ${error.message}`);
      }
    },

    // 下载音频
    async downloadAudio(item) {
      try {
        const audioUrl = this.selectedAudio[item.cid];

        console.log("选中的音频URL:", audioUrl); // 添加调试日志

        if (!audioUrl) {
          this.$message.error("请选择音频质量");
          return;
        }

        // 找到对应的视频信息
        const videoInfo = this.downloadInfo.find(video =>
          video.pages.some(page => page.cid === item.cid)
        );

        if (!videoInfo) {
          this.$message.error("未找到对应的视频信息");
          return;
        }

        // 创建下载任务
        const downloadItem = {
          avid: videoInfo.avid,
          cid: item.cid,
          title: item.title,
          audioUrl: audioUrl, // 确保这里的audioUrl是有效的
          audioFormat: this.getAudioFormat(item),
          isCompilations: videoInfo.isCompilations,
          videoName: videoInfo.videoName,
          type: "audio" // 下载类型：音频
        };

        console.log("准备下载音频:", downloadItem); // 添加调试日志

        // 发送下载请求 - 使用修正后的API调用
        const result = await window.api.download.startDownload(downloadItem);

        if (result.success) {
          this.$message.success("音频下载任务已添加");
          // 跳转到下载中页面
          this.$router.push("/download/downloading");
        } else {
          this.$message.error(`音频下载失败: ${result.message || result.error}`);
        }
      } catch (error) {
        console.error("下载音频失败", error);
        this.$message.error(`下载音频出错: ${error.message}`);
      }
    },

    // 下载视频（包含音频合并）
    async downloadVideo(item) {
      try {
        const videoUrl = this.selectedVideo[item.cid];
        const audioUrl = this.selectedAudio[item.cid];

        if (!videoUrl || !audioUrl) {
          this.$message.error('请选择视频和音频质量');
          return;
        }

        // 找到对应的视频信息
        const videoInfo = this.downloadInfo.find(video =>
          video.pages.some(page => page.cid === item.cid)
        );

        if (!videoInfo) {
          this.$message.error('未找到对应的视频信息');
          return;
        }

        // 创建下载任务 - 这是视频下载
        const downloadItem = {
          avid: videoInfo.avid,
          cid: item.cid,
          title: item.title,
          videoUrl: videoUrl,
          audioUrl: audioUrl,
          audioFormat: this.getAudioFormat(item),
          isCompilations: videoInfo.isCompilations,
          videoName: videoInfo.videoName
        };

        // 添加到下载队列
        const result = await window.api.download.startDownload(downloadItem);

        if (result.success) {
          // 对于视频下载，需要从下载信息中删除对应的页面
          await window.api.storage.removeDownloadInfoPage(videoInfo.avid, item.cid);

          // 从当前页面信息中也移除该视频
          this.updateLocalDownloadInfo(videoInfo.avid, item.cid);

          // 显示成功消息并跳转
          this.$message.success('视频下载任务已添加');
          this.$router.push('/download/downloading');
        } else {
          this.$message.error(`视频下载失败: ${result.message || result.error}`);
        }
      } catch (error) {
        console.error('添加下载任务失败', error);
        this.$message.error(`添加下载任务出错: ${error.message}`);
      }
    },

    // 下载全部视频 - 修改为多次调用单个视频下载
    async downloadAll() {
      try {
        // 收集所有下载项
        const downloadItems = [];

        this.downloadInfo.forEach(videoInfo => {
          // 提取合集信息
          const isCompilations = !!videoInfo.isCompilations;
          const videoName = videoInfo.videoName || '';

          videoInfo.pages.forEach(item => {
            const videoUrl = this.selectedVideo[item.cid];
            const audioUrl = this.selectedAudio[item.cid];

            if (videoUrl && audioUrl) {
              downloadItems.push({
                avid: videoInfo.avid,
                cid: item.cid,
                title: item.title,
                videoUrl: videoUrl,
                audioUrl: audioUrl,
                audioFormat: this.getAudioFormat(item),
                // 确保始终保留合集信息
                isCompilations: isCompilations,
                videoName: videoName,
                item: item // 原始页面item，用于后续调用
              });
            }
          });
        });

        if (downloadItems.length === 0) {
          this.$message.warning("没有可下载的项目");
          return;
        }

        // 显示确认对话框，告知用户将要下载的数量
        this.$confirm(`确定要下载所有${downloadItems.length}个视频吗?`, "批量下载确认", {
          confirmButtonText: "确定",
          cancelButtonText: "取消",
          type: "info"
        }).then(async () => {
          let successCount = 0;
          let failCount = 0;

          // 逐个调用视频下载函数
          for (const item of downloadItems) {
            try {
              // 创建下载任务，确保包含合集信息
              const downloadItem = {
                avid: item.avid,
                cid: item.cid,
                title: item.title,
                videoUrl: item.videoUrl,
                audioUrl: item.audioUrl,
                audioFormat: item.audioFormat,
                isCompilations: item.isCompilations,
                videoName: item.videoName
              };

              // 添加到下载队列
              const result = await window.api.download.startDownload(downloadItem);

              if (result.success) {
                // 对于视频下载，需要从下载信息中删除对应的页面
                await window.api.storage.removeDownloadInfoPage(item.avid, item.cid);

                // 从当前页面信息中也移除该视频
                this.updateLocalDownloadInfo(item.avid, item.cid);

                successCount++;
              } else {
                console.error(`下载视频 ${item.title} 失败:`, result.message || result.error);
                failCount++;
              }
            } catch (error) {
              console.error(`下载视频 ${item.title} 出错:`, error);
              failCount++;
            }
          }

          // 显示总体结果
          if (failCount === 0) {
            this.$message.success(`已成功添加${successCount}个下载任务`);
          } else {
            this.$message.warning(`已添加${successCount}个下载任务，${failCount}个任务添加失败`);
          }

          // 跳转到下载中页面
          this.$router.push("/download/downloading");
        }).catch(() => {
          // 取消操作
          this.$message.info("已取消批量下载");
        });
      } catch (error) {
        console.error("批量下载失败", error);
        this.$message.error(`批量下载出错: ${error.message}`);
      }
    },

    // 清空下载列表
    async clearAll() {
      try {
        if (this.downloadInfo.length === 0) {
          this.$message.warning("下载列表已经为空");
          return;
        }

        // 显示确认对话框
        this.$confirm("确定要清空所有下载项吗?", "提示", {
          confirmButtonText: "确定",
          cancelButtonText: "取消",
          type: "warning"
        }).then(async () => {
          // 逐个删除每个下载项
          for (const video of this.downloadInfo) {
            await window.api.storage.removeDownloadInfo(video.avid);
          }
          this.downloadInfo = [];
          this.selectedVideo = {};
          this.selectedAudio = {};
          this.$message.success("已清空下载列表");
        }).catch(() => {
          // 取消操作
          this.$message.info("已取消清空操作");
        });
      } catch (error) {
        console.error("清空下载列表失败", error);
        this.$message.error(`清空下载列表出错: ${error.message}`);
      }
    },

    // 添加辅助方法，用于更新本地下载信息状态（只在视频下载时使用）
    updateLocalDownloadInfo(avid, cid) {
      // 查找视频信息索引
      const videoIndex = this.downloadInfo.findIndex(video => video.avid === avid);
      if (videoIndex !== -1) {
        // 从页面中删除相应的cid
        const newPages = this.downloadInfo[videoIndex].pages.filter(page => page.cid !== cid);

        if (newPages.length === 0) {
          // 如果没有页面了，删除整个视频条目
          this.downloadInfo.splice(videoIndex, 1);
        } else {
          // 否则更新页面列表
          this.downloadInfo[videoIndex].pages = newPages;
        }
      }
    }
  }
};
</script>


<style scoped>
.waiting-view {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 0 clamp(28px, 5vw, 64px) 28px;
  overflow: hidden;
}

.waiting-toolbar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 58px;
  border-bottom: 1px solid #e2e7ed;
}

.path-setting {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.download-action {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.path-button {
  display: inline-flex;
  flex: 0 0 auto;
  height: 36px;
  border-color: #dfe5ec;
  color: #596575;
}

.path-button :deep(.el-icon) {
  margin-right: 7px;
}

.path-value {
  flex: 1;
  min-width: 0;
  color: #687585;
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.clear-button {
  color: #778392;
}

.download-info {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 16px 3px 12px 0;
  overflow: auto;
}

.download-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.download-item {
  display: flex;
  gap: 15px;
  min-height: 118px;
  padding: 12px;
  border: 1px solid #e3e8ee;
  border-radius: 11px;
  background: #fff;
  transition: border-color 150ms ease, transform 150ms ease;
}

.download-item:hover {
  border-color: #d2d9e1;
  transform: translateY(-1px);
}

.video-pic {
  width: 144px;
  height: 92px;
  flex: 0 0 144px;
  overflow: hidden;
  border-radius: 7px;
  background: #e9edf1;
}

.video-pic img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
}

.download-item-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  min-height: 34px;
}

.video-title {
  min-width: 0;
  overflow: hidden;
  color: #293645;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-action {
  display: flex;
  flex: 0 0 auto;
  gap: 5px;
}

.video-select {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-top: 9px;
}

.audio-quality,
.video-quality {
  display: flex;
  align-items: center;
}

.select-span {
  width: 34px;
  color: #8793a0;
  font-size: 11px;
}

.select-quality {
  width: 150px;
}

.empty-state {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 250px;
  gap: 14px;
  text-align: center;
}

.empty-state h3 {
  margin: 0;
  color: #354150;
  font-size: 14px;
  font-weight: 600;
}

@media (max-width: 900px) {
  .download-item-top {
    align-items: flex-start;
    flex-direction: column;
    gap: 5px;
  }

  .download-item {
    min-height: 138px;
  }

  .download-action {
    gap: 4px;
  }
}

@media (max-width: 650px) {
  .waiting-toolbar {
    align-items: stretch;
    flex-direction: column;
    padding: 10px 0;
  }

  .path-setting {
    flex-wrap: wrap;
    gap: 8px 12px;
  }

  .path-value {
    flex-basis: 100%;
  }

  .download-action {
    justify-content: flex-end;
  }

  .download-item {
    align-items: flex-start;
  }

  .video-pic {
    width: 100px;
    height: 72px;
    flex-basis: 100px;
  }
}
</style>
