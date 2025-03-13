<template>
  <div id="download">
    <el-container>
      <el-header>
        <el-menu
          :default-active="route.path"
          class="header-menu"
          mode="horizontal"
          router
        >
          <el-menu-item index="/download/waiting">
            待下载
          </el-menu-item>
          <el-menu-item index="/download/downloading">
            下载中
          </el-menu-item>
          <el-menu-item index="/download/downloaded">
            已完成
          </el-menu-item>
        </el-menu>
      </el-header>
      <el-main>
        <router-view></router-view>
      </el-main>
    </el-container>
  </div>
</template>

<script>
import { useRoute } from "vue-router";

export default {
  setup() {
    const route = useRoute();
    return {
      route
    };
  }
};
</script>

<style scoped>
.el-header {
  padding: 0;
  border: none;
  height: 50px;
}
.header-menu {
  height: 50px;
  width: 100%;
  border: none;
}

.header-menu .el-menu-item {
  width: 80px;
  text-align: center;
  color: #000;
  transition: none;
}
.header-menu .el-menu-item.is-active,
.header-menu .el-menu-item:hover
{
  color: #409eff;
  background-color: #fff;
}
.header-menu .el-menu-item.is-active {
  width: 50px;
  margin: 0 15px;
}
.el-main {
  margin: 0;
  padding: 0;
}
</style>
