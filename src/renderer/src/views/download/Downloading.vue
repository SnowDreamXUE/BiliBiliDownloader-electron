<template>
  <div class="downloading-wrapper">
    <div v-if="downloadingTasks.length === 0" class="no-data">
      <div class="empty-symbol" aria-hidden="true"><span></span><i></i></div>
      <h3>当前没有活动任务</h3>
      <p>添加视频后，下载和处理进度会显示在这里。</p>
      <el-button type="primary" plain @click="$router.push('/download/waiting')">查看待下载列表</el-button>
    </div>
    <div v-else class="task-list">
      <div class="task-list-header">
        <div>
          <h2>活动任务</h2>
          <span>正在下载或处理 {{ downloadingTasks.length }} 个项目</span>
        </div>
        <el-button size="small" type="danger" @click="cancelAllTasks">取消全部</el-button>
      </div>
      <div class="task-items">
        <div v-for="task in downloadingTasks" :key="`${task.avid}-${task.cid}`" class="task-item">
          <div class="task-info">
            <div class="task-title">{{ task.title }}</div>
            <div class="task-status" :class="{'task-error': task.status === 'failed'}">
              {{ getStatusText(task.status) }}
              <span v-if="task.error" class="error-msg">: {{ task.error }}</span>
            </div>
          </div>
          <div class="task-progress">
            <el-progress :percentage="task.progress || 0" :status="getProgressStatus(task)"></el-progress>
          </div>
          <div class="task-actions">
            <el-button
              v-if="task.status === 'downloading'"
              size="small"
              type="warning"
              @click="pauseTask(task)"
            >
              暂停
            </el-button>
            <el-button
              v-else-if="task.status === 'paused'"
              size="small"
              type="success"
              @click="resumeTask(task)"
            >
              继续
            </el-button>
            <el-button
              size="small"
              type="danger"
              @click="cancelTask(task.avid, task.cid)"
              :disabled="task.status === 'failed'"
            >
              取消
            </el-button>
            <el-button
              v-if="task.status === 'failed'"
              size="small"
              type="primary"
              @click="retryTask(task)"
            >
              重试
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      downloadingTasks: [],
      refreshInterval: null
    };
  },

  mounted() {
    this.loadTasks();
    // 每秒刷新一次下载状态
    this.refreshInterval = setInterval(() => {
      this.loadTasks();
    }, 1000);
  },

  beforeDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  },

  methods: {
    // 加载下载任务
    async loadTasks() {
      try {
        this.downloadingTasks = await window.api.storage.getDownloadingTasks();
      } catch (error) {
        console.error('加载下载任务失败', error);
      }
    },

    // 取消单个下载任务
    async cancelTask(avid, cid) {
      try {
        const result = await window.api.download.cancelDownload(avid, cid);
        if (result.success) {
          await window.api.storage.removeDownloadingTask(avid, cid);
          this.$message.success('已取消下载任务');
          await this.loadTasks();
        } else {
          this.$message.error(`取消任务失败: ${result.message || '未知错误'}`);
        }
      } catch (error) {
        console.error('取消下载任务失败', error);
        this.$message.error(`取消任务出错: ${error.message}`);
      }
    },

    async pauseTask(task) {
      try {
        const result = await window.api.download.pauseDownload(task.avid, task.cid);
        if (result.success) {
          this.$message.success('下载已暂停');
          await this.loadTasks();
        } else {
          this.$message.error(`暂停失败: ${result.message || '未知错误'}`);
        }
      } catch (error) {
        console.error('暂停下载失败', error);
        this.$message.error(`暂停下载出错: ${error.message}`);
      }
    },

    async resumeTask(task) {
      try {
        const result = await window.api.download.resumeDownload(this.createDownloadItem(task));
        if (result.success) {
          this.$message.success('已继续下载');
          await this.loadTasks();
        } else {
          this.$message.error(`继续下载失败: ${result.message || '未知错误'}`);
        }
      } catch (error) {
        console.error('继续下载失败', error);
        this.$message.error(`继续下载出错: ${error.message}`);
      }
    },

    // 取消所有下载任务
    async cancelAllTasks() {
      try {
        if (this.downloadingTasks.length === 0) {
          this.$message.warning('没有正在下载的任务');
          return;
        }

        this.$confirm('确定要取消所有下载任务吗?', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }).then(async () => {
          const results = await Promise.all(this.downloadingTasks.map(async task => {
            const result = await window.api.download.cancelDownload(task.avid, task.cid);
            if (result.success) {
              await window.api.storage.removeDownloadingTask(task.avid, task.cid);
            }
            return result;
          }));
          const failedCount = results.filter(result => !result.success).length;
          if (failedCount === 0) {
            this.$message.success('已取消所有下载任务');
          } else {
            this.$message.warning(`${failedCount} 个任务无法取消`);
          }
          await this.loadTasks();
        }).catch(() => {
          this.$message.info('已取消操作');
        });
      } catch (error) {
        console.error('取消所有下载任务失败', error);
        this.$message.error(`取消所有任务出错: ${error.message}`);
      }
    },

    // 重试下载任务
    async retryTask(task) {
      try {
        const result = await window.api.download.startDownload(this.createDownloadItem(task));

        if (result.success) {
          this.$message.success('已重新添加下载任务');
          this.loadTasks();
        } else {
          this.$message.error(`重试下载失败: ${result.message || result.error}`);
        }
      } catch (error) {
        console.error('重试下载任务失败', error);
        this.$message.error(`重试任务出错: ${error.message}`);
      }
    },

    // 只传递 IPC 所需的普通字段，避免把 Vue 响应式代理传入 Electron。
    createDownloadItem(task) {
      return {
        avid: task.avid,
        cid: task.cid,
        title: task.title,
        videoUrl: task.videoUrl,
        audioUrl: task.audioUrl,
        picUrl: task.picUrl,
        isCompilations: task.isCompilations,
        videoName: task.videoName,
        type: task.type,
        completedParts: Array.isArray(task.completedParts) ? [...task.completedParts] : [],
        downloadPhase: task.downloadPhase,
        progress: task.progress
      };
    },

    // 获取状态文本
    getStatusText(status) {
      const statusMap = {
        'downloading': '下载中',
        'paused': '已暂停',
        'merging': '合并中',
        'converting': '转换MP3中',  // 添加新状态
        'completed': '已完成',
        'failed': '失败'
      };
      return statusMap[status] || '未知状态';
    },

    // 获取进度条状态
    getProgressStatus(task) {
      if (task.status === 'failed') return 'exception';
      if (task.progress === 100) return 'success';
      return '';
    }
  }
};
</script>

<style scoped>
.downloading-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 0 clamp(24px, 5vw, 64px) 28px;
  overflow: hidden;
}

.task-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 3px 14px 0;
}

.no-data {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 250px;
  padding-bottom: 35px;
  text-align: center;
}

.task-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 0 0 auto;
  min-height: 66px;
  border-bottom: 1px solid #e2e7ed;
}

.task-list-header h2 {
  margin: 0;
  color: #2b3745;
  font-size: 14px;
  font-weight: 650;
}

.task-list-header > div > span {
  display: block;
  margin-top: 5px;
  color: #8793a0;
  font-size: 11px;
}

.task-items {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 18px;
  min-height: 91px;
  padding: 13px 15px;
  border: 1px solid #e3e8ee;
  border-radius: 10px;
  background: #fff;
}

.task-info {
  flex: 1.15;
  min-width: 170px;
}

.task-title {
  overflow: hidden;
  margin-bottom: 7px;
  color: #293645;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-status {
  overflow: hidden;
  color: #818d9a;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-error {
  color: #c64d62;
}

.error-msg {
  font-size: 10px;
}

.task-progress {
  flex: 1;
  min-width: 130px;
}

.task-progress :deep(.el-progress-bar__outer) {
  background: #edf0f3;
}

.task-progress :deep(.el-progress-bar__inner) {
  background: #fb7299;
}

.task-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.empty-symbol {
  position: relative;
  width: 54px;
  height: 42px;
  margin-bottom: 17px;
  border: 1px solid #d9e0e7;
  border-radius: 8px;
  background: #fff;
}

.empty-symbol::before {
  position: absolute;
  top: -6px;
  left: 5px;
  width: 17px;
  height: 8px;
  border: 1px solid #d9e0e7;
  border-bottom: 0;
  border-radius: 4px 4px 0 0;
  background: #fff;
  content: "";
}

.empty-symbol span {
  position: absolute;
  top: 17px;
  left: 20px;
  width: 0;
  height: 0;
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  border-left: 8px solid #fb7299;
}

.empty-symbol i {
  position: absolute;
  right: 8px;
  bottom: 7px;
  left: 8px;
  height: 1px;
  background: #e8ecf0;
}

.no-data h3 {
  margin: 0;
  color: #354150;
  font-size: 13px;
  font-weight: 600;
}

.no-data p {
  margin: 8px 0 16px;
  color: #8994a1;
  font-size: 11px;
}

@media (max-width: 900px) {
  .downloading-wrapper {
    padding-right: 22px;
    padding-left: 22px;
  }

  .task-item {
    flex-wrap: wrap;
    gap: 10px;
  }

  .task-progress {
    order: 1;
    flex-basis: 100%;
  }

  .task-actions {
    margin-left: auto;
  }
}
</style>
