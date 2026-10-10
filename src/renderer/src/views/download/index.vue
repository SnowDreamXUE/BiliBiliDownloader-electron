<template>
  <div class="download-page">
    <header class="download-header">
      <div class="download-heading">
        <h1>下载管理</h1>
      </div>
      <el-menu
        :default-active="route.path"
        class="download-tabs"
        mode="horizontal"
        router
      >
        <el-menu-item index="/download/waiting">待下载</el-menu-item>
        <el-menu-item index="/download/downloading">下载中</el-menu-item>
        <el-menu-item index="/download/downloaded">已完成</el-menu-item>
      </el-menu>
    </header>
    <section class="download-view">
      <router-view></router-view>
    </section>
  </div>
</template>

<script>
import { useRoute } from "vue-router";

export default {
  setup() {
    const route = useRoute();
    return { route };
  }
};
</script>

<style scoped>
.download-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.download-header {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  min-height: 112px;
  padding: 20px clamp(28px, 5vw, 64px) 0;
}

.download-heading h1 {
  margin: 0 0 12px;
  color: #1e2a37;
  font-size: 24px;
  font-weight: 680;
  letter-spacing: -0.035em;
}

.download-tabs {
  flex: 0 0 auto;
  min-width: 270px;
  border-bottom: 0;
  background: transparent;
}

.download-tabs :deep(.el-menu-item) {
  height: 43px;
  padding: 0 16px;
  border-bottom: 2px solid transparent;
  color: #758190;
  font-size: 12px;
  transition: color 150ms ease, border-color 150ms ease;
}

.download-tabs :deep(.el-menu-item:hover) {
  color: #293645;
  background: transparent;
}

.download-tabs :deep(.el-menu-item.is-active) {
  border-bottom-color: #fb7299;
  color: #df557d;
  background: transparent;
  font-weight: 650;
}

.download-view {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

@media (max-width: 860px) {
  .download-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 0;
    padding-top: 24px;
  }

  .download-tabs {
    min-width: 0;
    width: 100%;
  }
}
</style>
