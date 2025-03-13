<template>
  <div class="completed-wrapper">
    <div v-if="completedTasks.length === 0" class="no-data">
      <div>暂无已完成任务</div>
      <div>No completed tasks</div>
    </div>
    <div v-else class="completed-list">
      <div class="completed-header">
        <h3>已完成任务 ({{ completedTasks.length }})</h3>
        <el-button size="small" type="danger" @click="clearAllCompleted">清空记录</el-button>
      </div>
      <div class="completed-items">
        <div v-for="task in completedTasks" :key="`${task.avid}-${task.cid}`" class="completed-item">
          <div class="item-cover" v-if="task.picUrl">
            <img :src="task.picUrl" alt="封面" @error="handleImageError">
          </div>
          <div class="item-info">
            <div class="item-title">{{ task.title }}</div>
            <div class="item-path">
              <span>保存路径: {{ task.outputFilePath }}</span>
            </div>
            <div class="item-time">
              <span>完成时间: {{ formatDate(task.completedAt) }}</span>
            </div>
          </div>
          <div class="item-actions">
            <el-button size="small" type="primary" @click="openFile(task.outputFilePath)">打开文件</el-button>
            <el-button size="small" @click="openFolder(task.outputFilePath)">打开文件夹</el-button>
            <el-button size="small" type="danger" @click="removeTask(task.avid, task.cid)">删除记录</el-button>
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
      completedTasks: [],
      refreshInterval: null
    };
  },

  mounted() {
    this.loadCompletedTasks();
    // 每5秒刷新一次，防止数据不同步
    this.refreshInterval = setInterval(() => {
      this.loadCompletedTasks();
    }, 5000);
  },

  beforeDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  },

  methods: {
    // 加载已完成任务
    async loadCompletedTasks() {
      try {
        this.completedTasks = await window.api.storage.getCompletedTasks();
        // 按完成时间降序排序
        this.completedTasks.sort((a, b) => {
          return new Date(b.completedAt) - new Date(a.completedAt);
        });
      } catch (error) {
        console.error('加载已完成任务失败', error);
        this.$message.error(`加载已完成任务出错: ${error.message}`);
      }
    },

    // 打开文件
    async openFile(filePath) {
      try {
        if (!filePath) {
          this.$message.error('文件路径不存在');
          return;
        }

        const result = await window.api.file.openPath(filePath);
        if (!result.success) {
          throw new Error(result.error || '打开文件失败');
        }
      } catch (error) {
        console.error('打开文件失败', error);
        this.$message.error(`打开文件出错: ${error.message}`);
      }
    },

// 打开文件夹
    async openFolder(filePath) {
      try {
        if (!filePath) {
          this.$message.error('文件路径不存在');
          return;
        }

        // 获取文件所在文件夹路径
        const folderPath = filePath.substring(0, filePath.lastIndexOf('\\'));

        // 使用showItemInFolder方法，这样会同时打开文件夹并选中该文件
        const result = await window.api.file.showItemInFolder(filePath);
        if (!result.success) {
          // 如果showItemInFolder失败，尝试直接打开文件夹
          const fallbackResult = await window.api.file.openPath(folderPath);
          if (!fallbackResult.success) {
            throw new Error(fallbackResult.error || '打开文件夹失败');
          }
        }
      } catch (error) {
        console.error('打开文件夹失败', error);
        this.$message.error(`打开文件夹出错: ${error.message}`);
      }
    },

    // 删除任务记录
    async removeTask(avid, cid) {
      try {
        const result = await window.api.storage.removeCompletedTask(avid, cid);
        if (result.success) {
          this.$message.success('已删除记录');
          await this.loadCompletedTasks();
        } else {
          this.$message.error(`删除记录失败: ${result.message}`);
        }
      } catch (error) {
        console.error('删除记录失败', error);
        this.$message.error(`删除记录出错: ${error.message}`);
      }
    },

    // 清空所有记录
    async clearAllCompleted() {
      try {
        if (this.completedTasks.length === 0) {
          this.$message.warning('没有已完成的任务记录');
          return;
        }

        this.$confirm('确定要清空所有已完成任务记录吗?', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }).then(async () => {
          const promises = [];

          // 删除每个完成的任务记录
          for (const task of this.completedTasks) {
            promises.push(
              window.api.storage.removeCompletedTask(task.avid, task.cid)
            );
          }

          await Promise.all(promises);
          this.$message.success('已清空所有记录');
          await this.loadCompletedTasks();
        }).catch(() => {
          this.$message.info('已取消操作');
        });
      } catch (error) {
        console.error('清空记录失败', error);
        this.$message.error(`清空记录出错: ${error.message}`);
      }
    },

    // 格式化日期
    formatDate(dateString) {
      if (!dateString) return '未知时间';

      try {
        const date = new Date(dateString);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
      } catch (error) {
        return '日期格式错误';
      }
    },

    // 处理图片加载错误
    handleImageError(e) {
      e.target.src = '/path/to/placeholder-image.png'; // 设置一个默认的占位图
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


.completed-wrapper {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 100px);
  overflow-y: auto; /* 关键：使容器可以垂直滚动 */
  padding: 0 20px;
}

.completed-list {
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

.completed-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.completed-header h3 {
  margin: 0;
  font-size: 18px;
  color: #303133;
}

.completed-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.completed-item {
  display: flex;
  padding: 15px;
  border-radius: 4px;
  background-color: #fff;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.item-cover {
  width: 120px;
  height: 70px;
  margin-right: 15px;
  overflow: hidden;
  border-radius: 4px;
  flex-shrink: 0;
}

.item-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-right: 15px;
}

.item-title {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}

.item-path, .item-time {
  font-size: 13px;
  color: #606266;
}

.item-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
}
</style>
