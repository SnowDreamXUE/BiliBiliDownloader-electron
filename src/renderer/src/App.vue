<template>
  <div class="app-shell">
    <TitleBar title="BiliBili Downloader" />
    <div class="app-body">
      <aside class="sidebar">
        <div class="brand-lockup" title="BiliBili Downloader" aria-label="BiliBili Downloader">
          <div class="brand-mark" aria-hidden="true">B</div>
        </div>

        <el-menu :default-active="activeMenu" router class="app-menu">
          <el-menu-item index="/search" title="视频解析" aria-label="视频解析">
            <el-icon><Search /></el-icon>
          </el-menu-item>
          <el-menu-item index="/download" title="下载管理" aria-label="下载管理">
            <el-icon><Download /></el-icon>
          </el-menu-item>
          <el-menu-item index="/favorites" title="收藏夹下载" aria-label="收藏夹下载">
            <el-icon><Star /></el-icon>
          </el-menu-item>
          <el-menu-item index="/login" title="账号登录" aria-label="账号登录">
            <el-icon><User /></el-icon>
          </el-menu-item>
        </el-menu>

        <el-menu :default-active="activeMenu" router class="settings-menu">
          <el-menu-item index="/settings" title="下载配置" aria-label="下载配置">
            <el-icon><Setting /></el-icon>
          </el-menu-item>
        </el-menu>
      </aside>

      <main class="main-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import { Search, User, Download, Setting, Star } from "@element-plus/icons-vue";
import TitleBar from "./components/TitleBar.vue";

const route = useRoute();
const activeMenu = computed(() => `/${route.path.split("/")[1]}`);
</script>

<style>
.app-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: #202a36;
  background: #f2f4f7;
}

.app-shell .app-body {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.app-shell .sidebar {
  display: flex;
  flex: 0 0 68px;
  flex-direction: column;
  align-items: center;
  padding: 16px 8px 12px;
  color: #eef2f6;
  background: #172433;
}

.app-shell .brand-lockup {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin-bottom: 26px;
}

.app-shell .brand-mark {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  place-items: center;
  border-radius: 12px 12px 12px 5px;
  color: #fff;
  background: #fb7299;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -2px;
}

.app-shell .app-menu,
.app-shell .settings-menu {
  width: 100%;
  border-right: 0;
  background: transparent;
}

.app-shell .app-menu {
  flex: 1;
}

.app-shell .app-menu .el-menu-item,
.app-shell .settings-menu .el-menu-item {
  position: relative;
  display: flex;
  justify-content: center;
  width: 48px;
  height: 48px;
  padding: 0 !important;
  margin: 5px auto;
  border-radius: 12px;
  color: #aeb9c5;
  transition: color 150ms ease, background-color 150ms ease;
}

.app-shell .app-menu .el-menu-item .el-icon,
.app-shell .settings-menu .el-menu-item .el-icon {
  margin: 0;
  color: #91a0af;
  font-size: 20px;
}

.app-shell .app-menu .el-menu-item:hover,
.app-shell .settings-menu .el-menu-item:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.07);
}

.app-shell .app-menu .el-menu-item.is-active,
.app-shell .settings-menu .el-menu-item.is-active {
  color: #fff;
  background: rgba(251, 114, 153, 0.15);
}

.app-shell .app-menu .el-menu-item.is-active::before,
.app-shell .settings-menu .el-menu-item.is-active::before {
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: 0;
  width: 2px;
  border-radius: 0 2px 2px 0;
  background: #fb7299;
  content: "";
}

.app-shell .app-menu .el-menu-item.is-active .el-icon,
.app-shell .settings-menu .el-menu-item.is-active .el-icon {
  color: #fb8cab;
}

.app-shell .main-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 0;
  overflow: auto;
  background: #f2f4f7;
}

</style>
