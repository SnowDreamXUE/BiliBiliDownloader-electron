import { createRouter, createWebHashHistory } from "vue-router";

const routes = [
  {
    path: "/",
    name: "Home",
    redirect: "/search"
  },
  {
    path: "/search",
    name: "Search",
    component: () => import("../views/Search.vue")
  },
  {
    path: "/download",
    name: "Download",
    component: () => import("../views/Download/index.vue"),
    redirect: "/download/waiting",
    children: [
      {
        path: "/download/waiting",
        name: "Waiting",
        component: () => import("../views/Download/Waiting.vue")
      },
      {
        path: "/download/downloading",
        name: "Downloading",
        component: () => import("../views/Download/Downloading.vue")
      },
      {
        path: "/download/downloaded",
        name: "Downloaded",
        component: () => import("../views/Download/Downloaded.vue")
      }
    ]
  },
  {
    path: "/login",
    name: "Login",
    component: () => import("../views/Login.vue")
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});
export default router;
