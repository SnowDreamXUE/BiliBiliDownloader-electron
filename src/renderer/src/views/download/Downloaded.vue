<template>
  <div class="completed-wrapper">
    <div v-if="completedTasks.length === 0" class="no-data">
      <div class="empty-symbol" aria-hidden="true"><span></span><i></i></div>
      <h3>还没有已完成的下载</h3>
      <p>完成的文件会收录在这里，方便打开或查看所在文件夹。</p>
      <el-button type="primary" plain @click="$router.push('/download/waiting')">查看待下载列表</el-button>
    </div>
    <div v-else class="completed-list">
      <div class="completed-header">
        <div>
          <h2>已完成任务</h2>
          <span>已保存 {{ completedTasks.length }} 条记录</span>
        </div>
        <el-button size="small" @click="clearAllCompleted">清空记录</el-button>
      </div>
      <div class="completed-items">
        <div v-for="task in completedTasks" :key="`${task.avid}-${task.cid}`" class="completed-item">
          <div class="item-cover" v-if="task.picUrl">
            <img :src="task.picUrl" alt="视频封面" @error="handleImageError">
          </div>
          <div class="item-info">
            <div class="item-title" :title="task.title">{{ task.title }}</div>
            <div class="item-paths">
              <div v-for="filePath in getTaskOutputPaths(task)" :key="filePath" class="item-path">
                <span :title="filePath">{{ filePath }}</span>
                <div class="path-actions">
                  <el-button size="small" @click="openFile(filePath)">打开</el-button>
                  <el-button size="small" @click="openFolder(filePath)">文件夹</el-button>
                </div>
              </div>
            </div>
            <div class="item-time">
              <span>完成时间: {{ formatDate(task.completedAt) }}</span>
            </div>
          </div>
          <div class="item-actions">
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
    getTaskOutputPaths(task) {
      const paths = Array.isArray(task.outputFilePaths) ? task.outputFilePaths : [task.outputFilePath];
      return paths.filter(filePath => typeof filePath === 'string' && filePath.length > 0);
    },

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
      e.target.style.visibility = 'hidden';
    }
  }
};
</script>

<style scoped>
.completed-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 0 clamp(24px, 5vw, 64px) 28px;
  overflow: hidden;
}

.completed-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
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

.completed-header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  min-height: 66px;
  border-bottom: 1px solid #e2e7ed;
}

.completed-header h2 {
  margin: 0;
  color: #2b3745;
  font-size: 14px;
  font-weight: 650;
}

.completed-header > div > span {
  display: block;
  margin-top: 5px;
  color: #8793a0;
  font-size: 11px;
}

.completed-items {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 9px;
  min-height: 0;
  padding: 16px 3px 14px 0;
  overflow-y: auto;
}

.completed-item {
  display: flex;
  align-items: center;
  gap: 15px;
  min-height: 104px;
  padding: 12px;
  border: 1px solid #e3e8ee;
  border-radius: 10px;
  background: #fff;
}

.item-cover {
  position: relative;
  width: 128px;
  height: 74px;
  flex: 0 0 128px;
  overflow: hidden;
  border-radius: 7px;
  background: linear-gradient(135deg, #e9edf2, #f7e7ec);
}

.item-cover img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-info {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  margin-right: 5px;
}

.item-title {
  overflow: hidden;
  color: #293645;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-time {
  overflow: hidden;
  color: #818d9a;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-paths {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.item-path {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  color: #818d9a;
  font-size: 10px;
}

.item-path > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 4px;
}

.path-actions :deep(.el-button) {
  height: 24px;
  padding: 0 7px;
  font-size: 10px;
}

.item-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
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
  .completed-wrapper {
    padding-right: 22px;
    padding-left: 22px;
  }

  .completed-item {
    flex-wrap: wrap;
  }

  .item-info {
    min-width: calc(100% - 155px);
  }

  .item-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
