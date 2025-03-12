import { createApp } from "vue";
import App from "./App.vue";
import ElementPlus, { ElNotification } from "element-plus";
import "element-plus/dist/index.css";
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import router from "./router";
import pinia from "./stores";
import axios from "axios";

const app = createApp(App);

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.config.globalProperties.$axios = axios;
app.config.globalProperties.$notify = ElNotification;

app.use(ElementPlus);
app.use(router);
app.use(pinia);
app.mount("#app");
