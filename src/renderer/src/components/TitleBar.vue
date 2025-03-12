<template>
  <div
    class="titlebar"
    :class="{ 'is-maximized': isMaximized }"
    data-platform="darwin"
  >
    <el-row :gutter="0" class="titlebar-row">
      <el-col :span="4" class="left-col"></el-col>
      <el-col :span="16" class="title-col">
        <div class="window-title">{{ title }}</div>
      </el-col>
      <el-col :span="4" class="control-col">
        <div class="window-controls" @dblclick.stop>
          <!-- 按钮顺序调整为：最小化、最大化、关闭 -->
          <button class="control-button minimize" @click="minimize"></button>
          <button
            class="control-button maximize"
            :class="{ restored: isMaximized }"
            @click="toggleMaximize"
          ></button>
          <button class="control-button close" @click="close"></button>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
export default {
  name: 'TitleBar',
  props: {
    title: {
      type: String,
      default: 'Electron App'
    }
  },
  data() {
    return {
      platform: window.api.platform, // 仍然获取平台信息，但界面统一使用Mac风格
      isMaximized: false
    }
  },
  mounted() {
    window.electron.window.onMaximizeChange((isMaximized) => {
      this.isMaximized = isMaximized
    })

    // 添加双击标题栏最大化/还原的功能
    this.$el.addEventListener('dblclick', this.handleDoubleClick)
  },
  beforeUnmount() {
    this.$el.removeEventListener('dblclick', this.handleDoubleClick)
  },
  methods: {
    minimize() {
      window.electron.window.minimize()
    },
    toggleMaximize() {
      window.electron.window.maximize()
    },
    close() {
      window.electron.window.close()
    },
    handleDoubleClick(event) {
      // 确保双击的是标题栏区域，而不是控制按钮
      if (!event.target.closest('.window-controls')) {
        this.toggleMaximize()
      }
    }
  }
}
</script>

<style scoped>
.titlebar {
  height: 30px;
  background-color: #f1f1f1;
  user-select: none;
  -webkit-app-region: drag;
  width: 100%;
}

.titlebar-row {
  height: 100%;
  margin: 0 !important;
}

.control-col, .title-col, .left-col {
  height: 100%;
  display: flex;
  align-items: center;
}

.title-col {
  justify-content: center;
}

.window-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 30px;
}

.window-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end; /* 按钮靠右对齐 */
  -webkit-app-region: no-drag;
  height: 100%;
  padding-right: 12px;
}

.control-col {
  justify-content: flex-end;
}

.control-button {
  width: 16px; /* 增大按钮尺寸 */
  height: 16px;
  margin: 0 6px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

/* macOS 风格按钮颜色 */
.control-button.minimize {
  background-color: #ffbd2e;
}
.control-button.minimize:hover {
  background-color: #ffcd45;
  transform: scale(1.1);
}

.control-button.maximize {
  background-color: #28c940;
}
.control-button.maximize:hover {
  background-color: #3dd958;
  transform: scale(1.1);
}

.control-button.close {
  background-color: #ff5f57;
}
.control-button.close:hover {
  background-color: #ff7b72;
  transform: scale(1.1);
}
</style>
