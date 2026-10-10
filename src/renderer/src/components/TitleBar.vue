<template>
  <header
    class="titlebar"
    :class="{ 'is-maximized': isMaximized }"
    @dblclick="handleDoubleClick"
  >
    <div class="titlebar-brand">
      <span class="titlebar-mark" aria-hidden="true">B</span>
      <span class="window-title">{{ title }}</span>
    </div>
    <div class="window-controls" @dblclick.stop>
      <button class="control-button minimize" type="button" aria-label="最小化" @click="minimize">
        <span class="minimize-glyph" aria-hidden="true"></span>
      </button>
      <button
        class="control-button maximize"
        type="button"
        :aria-label="isMaximized ? '还原窗口' : '最大化'"
        @click="toggleMaximize"
      >
        <span class="maximize-glyph" :class="{ restored: isMaximized }" aria-hidden="true"></span>
      </button>
      <button class="control-button close" type="button" aria-label="关闭" @click="close">
        <span class="close-glyph" aria-hidden="true"></span>
      </button>
    </div>
  </header>
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
      isMaximized: false
    }
  },
  mounted() {
    window.electron.window.onMaximizeChange((isMaximized) => {
      this.isMaximized = isMaximized
    });
  },
  methods: {
    minimize() {
      window.electron.window.minimize();
    },
    toggleMaximize() {
      window.electron.window.maximize();
    },
    close() {
      window.electron.window.close();
    },
    handleDoubleClick(event) {
      if (!event.target.closest('.window-controls')) {
        this.toggleMaximize();
      }
    }
  }
}
</script>

<style scoped>
.titlebar {
  display: flex;
  flex: 0 0 38px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 38px;
  padding-left: 15px;
  color: #d7e0e9;
  background: #172433;
  user-select: none;
  -webkit-app-region: drag;
}

.titlebar-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.titlebar-mark {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border-radius: 6px 6px 6px 2px;
  color: #fff;
  background: #fb7299;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -1px;
}

.window-title {
  overflow: hidden;
  color: #d7e0e9;
  font-size: 12px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.window-controls {
  display: flex;
  height: 100%;
  -webkit-app-region: no-drag;
}

.control-button {
  position: relative;
  display: grid;
  width: 44px;
  height: 38px;
  place-items: center;
  padding: 0;
  border: 0;
  color: #c1cbd5;
  background: transparent;
  cursor: pointer;
}

.control-button:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.09);
}

.control-button.close:hover {
  background: #d94e68;
}

.minimize-glyph {
  width: 10px;
  height: 1px;
  background: currentColor;
}

.maximize-glyph {
  width: 9px;
  height: 8px;
  border: 1px solid currentColor;
  border-radius: 1px;
}

.maximize-glyph.restored {
  position: relative;
  margin: 2px 0 0 -2px;
}

.maximize-glyph.restored::before {
  position: absolute;
  top: -4px;
  left: 3px;
  width: 7px;
  height: 6px;
  border: 1px solid currentColor;
  border-bottom: 0;
  content: "";
}

.close-glyph::before,
.close-glyph::after {
  position: absolute;
  top: 18px;
  left: 17px;
  width: 11px;
  height: 1px;
  background: currentColor;
  content: "";
}

.close-glyph::before {
  transform: rotate(45deg);
}

.close-glyph::after {
  transform: rotate(-45deg);
}
</style>
