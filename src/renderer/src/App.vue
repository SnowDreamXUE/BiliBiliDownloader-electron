<template>
  <div class="app-shell">
    <TitleBar title="BiliBili Downloader" />
    <div class="app-body">
      <aside class="sidebar">
        <div class="brand-lockup">
          <div class="brand-mark" aria-hidden="true">B</div>
          <div class="brand-copy">
            <strong>哔哩下载器</strong>
            <span>本地媒体工作台</span>
          </div>
        </div>

        <div class="nav-caption">工作区</div>
        <el-menu :default-active="activeMenu" router class="app-menu">
          <el-menu-item index="/search">
            <el-icon><Search /></el-icon>
            <span>视频解析</span>
          </el-menu-item>
          <el-menu-item index="/download">
            <el-icon><Download /></el-icon>
            <span>下载管理</span>
          </el-menu-item>
          <el-menu-item index="/login">
            <el-icon><User /></el-icon>
            <span>账号登录</span>
          </el-menu-item>
        </el-menu>

        <div class="sidebar-footer">
          <span class="footer-indicator" aria-hidden="true"></span>
          <div>
            <strong>文件保存在本机</strong>
            <span>下载目录由你决定</span>
          </div>
        </div>
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
import { Search, User, Download } from "@element-plus/icons-vue";
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
  flex: 0 0 208px;
  flex-direction: column;
  padding: 25px 14px 16px;
  color: #eef2f6;
  background: #172433;
}

.app-shell .brand-lockup {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 9px;
  margin-bottom: 42px;
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

.app-shell .brand-copy,
.app-shell .sidebar-footer > div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.app-shell .brand-copy strong {
  color: #fff;
  font-size: 14px;
  font-weight: 650;
  letter-spacing: 0.02em;
}

.app-shell .brand-copy span {
  margin-top: 4px;
  color: #91a0af;
  font-size: 11px;
}

.app-shell .nav-caption {
  padding: 0 12px;
  margin: 0 0 10px;
  color: #8493a3;
  font-size: 11px;
}

.app-shell .app-menu {
  flex: 1;
  border-right: 0;
  background: transparent;
}

.app-shell .app-menu .el-menu-item {
  position: relative;
  height: 46px;
  padding: 0 13px !important;
  margin: 4px 0;
  border-radius: 9px;
  color: #aeb9c5;
  font-size: 13px;
  transition: color 150ms ease, background-color 150ms ease;
}

.app-shell .app-menu .el-menu-item .el-icon {
  margin-right: 12px;
  color: #91a0af;
  font-size: 17px;
}

.app-shell .app-menu .el-menu-item:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.07);
}

.app-shell .app-menu .el-menu-item.is-active {
  color: #fff;
  background: rgba(251, 114, 153, 0.15);
}

.app-shell .app-menu .el-menu-item.is-active::before {
  position: absolute;
  top: 11px;
  bottom: 11px;
  left: 0;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: #fb7299;
  content: "";
}

.app-shell .app-menu .el-menu-item.is-active .el-icon {
  color: #fb8cab;
}

.app-shell .sidebar-footer {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 10px 3px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.app-shell .footer-indicator {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  margin-top: 5px;
  border-radius: 50%;
  background: #7bc7a1;
  box-shadow: 0 0 0 3px rgba(123, 199, 161, 0.13);
}

.app-shell .sidebar-footer strong {
  color: #d9e0e7;
  font-size: 11px;
  font-weight: 550;
}

.app-shell .sidebar-footer span:not(.footer-indicator) {
  margin-top: 5px;
  color: #8493a3;
  font-size: 10px;
}

.app-shell .main-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 0;
  overflow: auto;
  background: #f2f4f7;
}

@media (max-width: 900px) {
  .app-shell .sidebar {
    flex-basis: 176px;
  }

  .app-shell .brand-lockup {
    padding: 0 4px;
  }
}
</style>
