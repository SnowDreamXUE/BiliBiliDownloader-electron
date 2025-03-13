<template>
  <div id="app">
    <TitleBar title="BiliBiliDownloader" />
    <el-container class="app-container">
      <el-aside>
        <el-menu
          :default-active="activeMenu"
          background-color="#f1f1f1"
          router
          class="side-menu"
        >
          <div class="user-avatar">
            <img alt="avatar" src="./assets/avatar-default.png" />
          </div>
          <el-menu-item index="/search">
            <div class="icon">
              <Search />
            </div>
          </el-menu-item>
          <el-menu-item index="/download">
            <div class="icon">
              <Download />
            </div>
          </el-menu-item>
          <el-menu-item index="/login">
            <div class="icon">
              <User />
            </div>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main>
        <router-view></router-view>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { useRoute } from "vue-router";
import { Search, User, Download } from "@element-plus/icons-vue";
import TitleBar from "./components/TitleBar.vue";
import { computed } from "vue";

const route = useRoute();
const activeMenu = computed(() => {
  return "/" + route.path.split("/")[1];
});
</script>

<style scoped>
.app-container {
  height: calc(100vh - 30px); /* 减去标题栏高度 */
  width: 100%;
}

.el-main {
  height: 100%;
  padding: 0;
  margin: 0;
  overflow: hidden;
}

.el-aside {
  width: 50px;
  height: 100%;
  margin: 0;
}

.side-menu {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  padding: 0;
  width: 50px;
  height: 100%;
}

.side-menu .el-menu-item {
  display: flex;
  width: 40px;
  height: 40px;
  margin: 5px;
  justify-content: center;
  align-items: center;
  transition: none;
}

.icon {
  display: flex;
  justify-content: center;
  align-items: center;

  svg {
    width: 20px;
  }
}

.side-menu .el-menu-item.is-active {
  border-radius: 30%;
  background: rgb(214, 214, 214);
}

.side-menu .el-menu-item:hover {
  border-radius: 30%;
  background: rgb(214, 214, 214);
}

.user-avatar {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  margin: 5px;
  background: #fff;
  border-radius: 50%;

  img {
    width: 80%;
  }
}

/* 为标题栏添加样式，确保它占据顶部位置 */
:deep(.titlebar) {
  height: 30px;
  width: 100%;
  -webkit-app-region: drag; /* 使标题栏可拖动 */
}

/* 确保按钮可以点击 */
:deep(.titlebar .control-button) {
  -webkit-app-region: no-drag;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

</style>
