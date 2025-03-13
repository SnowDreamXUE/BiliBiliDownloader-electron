<template>
  <div class="downloading-wrapper">
    <div v-if="downloadingTasks.length === 0" class="no-data">
      <div>暂无下载任务</div>
      <div>No downloading tasks</div>
    </div>
    <div v-else class="task-list">
      <div class="task-list-header">
        <h3>下载中任务 ({{ downloadingTasks.length }})</h3>
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
        const result = await window.ipcRenderer.invoke('cancel-download', avid, cid);
        if (result.success) {
          // 从下载中列表移除
          await window.api.storage.removeDownloadingTask(avid, cid);
          this.$message.success('已取消下载任务');
          // 重新加载任务列表
          this.loadTasks();
        } else {
          this.$message.error(`取消任务失败: ${result.message || '未知错误'}`);
        }
      } catch (error) {
        console.error('取消下载任务失败', error);
        this.$message.error(`取消任务出错: ${error.message}`);
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
          const promises = [];

          // 取消每个下载任务
          for (const task of this.downloadingTasks) {
            promises.push(
              window.ipcRenderer.invoke('cancel-download', task.avid, task.cid)
                .then(() => window.api.storage.removeDownloadingTask(task.avid, task.cid))
            );
          }

          await Promise.all(promises);
          this.$message.success('已取消所有下载任务');
          this.loadTasks();
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
        // 移除失败的任务
        await window.api.storage.removeDownloadingTask(task.avid, task.cid);

        // 重新创建下载任务
        const downloadItem = {
          avid: task.avid,
          cid: task.cid,
          title: task.title,
          videoUrl: task.videoUrl,
          audioUrl: task.audioUrl,
          picUrl: task.picUrl,
          isCompilations: task.isCompilations,
          videoName: task.videoName
        };

        // 发送下载请求
        const result = await window.ipcRenderer.invoke('start-download', downloadItem);

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

    // 获取状态文本
    getStatusText(status) {
      const statusMap = {
        'downloading': '下载中',
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
/* 全局滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f5f7fa;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #a0cffd;
  border-radius: 4px;
  transition: background 0.3s;
}

::-webkit-scrollbar-thumb:hover {
  background: #60acfa;
}

::-webkit-scrollbar-corner {
  background: #f5f7fa;
}

.downloading-wrapper {
  display: flex;
  flex-direction: column;
  /* 调整高度，确保出现滚动条 */
  height: calc(100vh - 100px);
  overflow-y: auto; /* 关键：使容器可以垂直滚动 */
  padding: 0 20px;
}

.task-tabs-content {
  height: calc(100vh - 150px); /* 适当减小，留出tab头部的空间 */
  overflow-y: auto; /* 确保内容区域可滚动 */
}

/* 确保任务列表可以滚动 */
.task-list {
  max-height: 100%;
  overflow-y: auto;
  padding-bottom: 20px;
}

.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #909399;
  font-size: 16px;
}

.task-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.task-list-header h3 {
  margin: 0;
  font-size: 18px;
  color: #303133;
}

.task-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-item {
  display: flex;
  align-items: center;
  padding: 15px;
  border-radius: 4px;
  background-color: #fff;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.task-info {
  flex: 2;
  margin-right: 15px;
}

.task-title {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 8px;
  word-break: break-all;
}

.task-status {
  font-size: 14px;
  color: #606266;
}

.task-error {
  color: #f56c6c;
}

.error-msg {
  font-size: 12px;
}

.task-progress {
  flex: 3;
  margin-right: 15px;
}

.task-actions {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
