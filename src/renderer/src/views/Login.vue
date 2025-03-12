<template>
  <div class="login">
    <el-card>
      <div class="user-info" v-if="isLoggedIn">
        <el-avatar :size="64" :src="face"></el-avatar>
        <div class="user-name">{{ uname }}</div>
        <el-button type="danger" @click="logout">退出登录</el-button>
      </div>
      <div class="login-btns" v-else>
        <el-button type="primary" @click="login_url" :loading="isGenerating">
          {{ isGenerating ? '生成中...' : '生成登录二维码' }}
        </el-button>
        <el-button @click="stopCheck" :disabled="!pollingIntervalId">终止轮询</el-button>
      </div>
    </el-card>

    <div class="qrcode-container" v-if="showQrcode">
      <canvas id="qrcode"></canvas>
      <div class="qrcode-status">{{ qrcodeStatus }}</div>
    </div>
  </div>
</template>

<script>
import QRCode from "qrcode";

export default {
  name: 'Login',
  data() {
    return {
      showQrcode: false, // 控制二维码展示
      login_image_url: "", // 登录二维码URL
      qrcode_key: "", // 登录二维码key
      pollingIntervalId: null, // 轮询ID
      isGenerating: false, // 是否正在生成二维码
      isLoggedIn: false, // 是否已登录
      uname: "", // 用户名
      face: "", // 用户头像
      qrcodeStatus: "等待扫码...", // 二维码状态提示
      loginSuccessFlag: false, // 登录成功标志，用于防止重复处理
    }
  },
  mounted() {
    // 页面加载时检查登录状态
    this.checkLoginStatus();
  },
  methods: {
    // 检查登录状态
    async checkLoginStatus() {
      try {
        const res = await window.api.http.get("https://api.bilibili.com/x/web-interface/nav");
        if (res.data && res.data.code === 0 && res.data.data.isLogin) {
          this.isLoggedIn = true;
          this.uname = res.data.data.uname;
          this.face = res.data.data.face;
        } else {
          this.isLoggedIn = false;
        }
      } catch (error) {
        console.error("检查登录状态失败:", error);
        this.isLoggedIn = false;
      }
    },

    // 生成登录二维码
    async login_url() {
      try {
        this.isGenerating = true;
        this.qrcodeStatus = "正在生成二维码...";
        this.loginSuccessFlag = false; // 重置登录标志

        const res = await window.api.http.get("https://passport.bilibili.com/x/passport-login/web/qrcode/generate");

        if (res.data && res.data.code === 0) {
          this.login_image_url = res.data.data.url;
          this.qrcode_key = res.data.data.qrcode_key;

          // 先设置 showQrcode 为 true，确保 <canvas> 渲染
          this.showQrcode = true;
          this.qrcodeStatus = "等待扫码...";

          // 使用 $nextTick 确保 DOM 已更新后再生成二维码
          this.$nextTick(() => {
            QRCode.toCanvas(document.getElementById("qrcode"), this.login_image_url, {width: 200}, (error) => {
              if (error) {
                console.error("生成二维码失败:", error);
                this.$notify.error({
                  title: '生成二维码失败',
                  message: error.message || '请稍后再试',
                  duration: 3000
                });
                this.showQrcode = false;
              }
            });
          });

          this.pollLoginStatus();
        } else {
          throw new Error(res.data.message || "获取二维码失败");
        }
      } catch (error) {
        console.error("获取登录二维码失败:", error);
        this.$notify.error({
          title: '获取二维码失败',
          message: error.message || '请稍后再试',
          duration: 3000
        });
      } finally {
        this.isGenerating = false;
      }
    },

    // 轮询登录状态
    pollLoginStatus() {
      const POLL_INTERVAL = 3000; // 轮询间隔时间，单位为毫秒
      const MAX_POLL_TIME = 180000; // 最大轮询时间，单位为毫秒（180秒）

      this.pollingIntervalId = setInterval(this.login_check, POLL_INTERVAL);

      // 设置最大轮询时间
      setTimeout(() => {
        if (this.pollingIntervalId) {
          this.stopCheck();
          this.$notify.error({
            title: '二维码已过期',
            message: '请重新生成登录二维码',
            duration: 3000
          });
          this.qrcodeStatus = "二维码已过期";
        }
      }, MAX_POLL_TIME);
    },

    // 检查登录状态
    async login_check() {
      try {
        // 如果已经登录成功，则停止轮询
        if (this.loginSuccessFlag) {
          this.stopCheck();
          return;
        }

        const response = await window.api.http.get(`https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${this.qrcode_key}`);

        // console.log('轮询响应:', response.data);

        if (response.data && response.data.code === 0) {
          const data = response.data.data || {};

          // 检查是否有url字段，这表示登录成功
          if (data.url) {
            // 标记登录成功，防止重复处理
            this.loginSuccessFlag = true;
            this.qrcodeStatus = "登录成功！正在处理...";

            // 从URL中提取cookie信息
            await this.extractCookiesFromUrl(data.url);

            // 获取用户信息
            await this.getUserInfo();

            // 停止轮询
            this.stopCheck();
          } else {
            // 处理不同状态
            const status = data.status || 0;

            if (status === 0) {
              this.qrcodeStatus = "等待扫码...";
            } else if (status === 1) {
              this.qrcodeStatus = "已扫码，请在手机上确认...";
            }
          }
        } else if (response.data.code === 86038 || response.data.code === 86039) {
          // 二维码已失效
          this.qrcodeStatus = "二维码已失效";
          this.$notify.error({
            title: '二维码已失效',
            message: '请重新生成二维码',
            duration: 3000
          });
          this.stopCheck();
        } else if (response.data.code === 86090 || response.data.code === 86101) {
          // 等待扫码
          this.qrcodeStatus = "等待扫码...";
        }
      } catch (error) {
        // console.error('获取登录状态失败:', error);
        this.$notify.error({
          title: '获取登录状态失败',
          message: error.message || '请检查网络连接',
          duration: 3000
        });
        this.stopCheck();
      }
    },

    // 从URL中提取并保存cookie
    async extractCookiesFromUrl(url) {
      try {
        // 解析URL获取参数
        const urlObj = new URL(url);
        const params = new URLSearchParams(urlObj.search);

        // 提取关键cookie信息
        const cookieData = {
          DedeUserID: params.get('DedeUserID') || urlObj.pathname.split('/').pop(),
          DedeUserID__ckMd5: params.get('DedeUserID__ckMd5'),
          Expires: params.get('Expires'),
          SESSDATA: params.get('SESSDATA'),
          bili_jct: params.get('bili_jct')
        };

        // console.log('提取的cookie数据:', cookieData);

        // 调用主进程手动设置这些cookie
        await window.api.setCookies(cookieData);

        return true;
      } catch (error) {
        // console.error('提取cookie失败:', error);
        this.$notify.error({
          title: '提取登录信息失败',
          message: '请重新尝试登录',
          duration: 3000
        });
        return false;
      }
    },

    // 终止轮询
    stopCheck() {
      if (this.pollingIntervalId) {
        clearInterval(this.pollingIntervalId); // 清除轮询
        this.pollingIntervalId = null; // 清空轮询ID
      }
    },

    // 查询登录用户信息
    async getUserInfo() {
      try {
        const res = await window.api.http.get("https://api.bilibili.com/x/web-interface/nav");
        // console.log("用户信息:", res.data);

        if (res.data.code === 0 && res.data.data.isLogin) {
          this.isLoggedIn = true;
          this.uname = res.data.data.uname;
          this.face = res.data.data.face;

          this.$notify.success({
            title: "登录成功",
            message: "欢迎，" + this.uname + "!",
            duration: 3000
          });

          // 隐藏二维码
          this.showQrcode = false;
        } else {
          this.isLoggedIn = false;
          this.$notify.error({
            title: "登录失败",
            message: "请重新尝试登录!",
            duration: 3000
          });
        }
      } catch (error) {
        // console.error("获取用户信息失败:", error);
        this.$notify.error({
          title: "获取用户信息失败",
          message: error.message || "请稍后重试",
          duration: 3000
        });
      }
    },

    // 退出登录
    async logout() {
      try {
        await window.api.http.get("https://passport.bilibili.com/login/exit/v2");
        await window.api.clearCookies(); // 清除保存的cookies

        this.isLoggedIn = false;
        this.uname = "";
        this.face = "";

        this.$notify.success({
          title: "已退出登录",
          message: "您已成功退出登录",
          duration: 3000
        });
      } catch (error) {
        // console.error("退出登录失败:", error);
        this.$notify.error({
          title: "退出登录失败",
          message: error.message || "请稍后重试",
          duration: 3000
        });
      }
    }
  }
}
</script>

<style scoped>
.login {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 100px;
}

.el-card {
  width: 600px;
  margin-bottom: 20px;
}

.login-btns {
  display: flex;
  justify-content: space-around;
  align-items: center;
  width: 100%;
}

.qrcode-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 20px;
}

.qrcode-status {
  margin-top: 10px;
  color: #666;
  font-size: 14px;
}

.user-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px;
}

.user-name {
  font-size: 18px;
  margin: 0 20px;
  flex-grow: 1;
  text-align: left;
}

#qrcode {
  display: block;
  margin: 0 auto;
}
</style>
