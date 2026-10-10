<template>
  <div class="settings-page">
    <header class="settings-header">
      <h1>下载配置</h1>
      <div class="settings-actions">
        <el-button text @click="resetConfig">恢复默认</el-button>
        <el-button type="primary" @click="saveConfig">保存配置</el-button>
      </div>
    </header>

    <section class="settings-panel" aria-label="默认下载配置">
      <div class="settings-row path-row">
        <span class="setting-label">保存目录</span>
        <div class="setting-control path-control">
          <el-button class="choose-path" @click="selectDownloadPath">
            <el-icon><FolderOpened /></el-icon>
            选择目录
          </el-button>
          <span class="path-value" :title="downloadPath || '未设置'">
            {{ downloadPath || "未设置" }}
          </span>
        </div>
      </div>

      <div class="settings-row">
        <span class="setting-label">画质</span>
        <el-radio-group v-model="config.quality" class="setting-control radio-options">
          <el-radio
            v-for="option in qualityOptions"
            :key="option.value"
            :label="option.value"
            :disabled="isQualityDisabled(option)"
            :title="getQualityDisabledReason(option)"
          >
            {{ option.label }}
          </el-radio>
        </el-radio-group>
      </div>

      <div class="settings-row">
        <span class="setting-label">编码</span>
        <el-radio-group v-model="config.codec" class="setting-control radio-options">
          <el-radio v-for="option in codecOptions" :key="option.value" :label="option.value">
            {{ option.label }}
          </el-radio>
        </el-radio-group>
      </div>

      <div class="settings-row">
        <span class="setting-label">音质</span>
        <el-radio-group v-model="config.audio" class="setting-control radio-options">
          <el-radio
            v-for="option in audioOptions"
            :key="option.value"
            :label="option.value"
            :disabled="isAudioDisabled(option)"
            :title="getAudioDisabledReason(option)"
          >
            {{ option.label }}
          </el-radio>
        </el-radio-group>
      </div>
    </section>
  </div>
</template>

<script>
import { FolderOpened } from "@element-plus/icons-vue";
import {
  AUDIO_OPTIONS,
  DEFAULT_DOWNLOAD_CONFIG,
  loadDownloadConfig,
  QUALITY_OPTIONS,
  saveDownloadConfig
} from "../utils/downloadConfig";

export default {
  components: { FolderOpened },
  data() {
    return {
      config: loadDownloadConfig(),
      downloadPath: "",
      accountCapabilities: {
        checking: true,
        known: false,
        loggedIn: false,
        isVip: false
      },
      qualityOptions: [
        { label: "最高可用", value: "auto" },
        ...QUALITY_OPTIONS.map(option => ({
          label: option.label,
          value: String(option.qualityId),
          requiresLogin: option.requiresLogin,
          requiresVip: option.requiresVip,
          unsupported: option.unsupported
        }))
      ],
      codecOptions: [
        { label: "自动", value: "auto" },
        { label: "AVC", value: "7" },
        { label: "HEVC", value: "12" },
        { label: "AV1", value: "13" }
      ],
      audioOptions: [
        { label: "最高可用", value: "auto" },
        ...AUDIO_OPTIONS.map(option => ({
          label: option.label,
          value: String(option.audioId),
          requiresVip: option.requiresVip
        }))
      ]
    };
  },
  mounted() {
    this.getDownloadPath();
    this.loadAccountCapabilities();
  },
  methods: {
    async getDownloadPath() {
      try {
        this.downloadPath = await window.api.download.getDirectory() || "";
      } catch (error) {
        console.error("获取下载路径失败", error);
        this.$message.error(`获取下载路径失败: ${error.message}`);
      }
    },
    async selectDownloadPath() {
      try {
        const result = await window.api.download.selectDirectory();
        if (result.success) this.downloadPath = result.path;
      } catch (error) {
        console.error("选择下载路径失败", error);
        this.$message.error(`选择下载路径失败: ${error.message}`);
      }
    },
    async loadAccountCapabilities() {
      try {
        const hasSession = await window.api.isLoggedIn();
        if (!hasSession) {
          this.accountCapabilities = {
            checking: false,
            known: true,
            loggedIn: false,
            isVip: false
          };
          return;
        }

        const response = await window.api.http.get("https://api.bilibili.com/x/web-interface/nav");
        const result = response?.data;
        const account = result?.data;
        if (result?.code === 0 && account && typeof account.isLogin === "boolean") {
          this.accountCapabilities = {
            checking: false,
            known: true,
            loggedIn: account.isLogin,
            isVip: account.isLogin && Number(account.vipStatus) === 1
          };
        } else if (result?.code === -101 || account?.isLogin === false) {
          this.accountCapabilities = {
            checking: false,
            known: true,
            loggedIn: false,
            isVip: false
          };
        } else {
          this.accountCapabilities = { ...this.accountCapabilities, checking: false };
        }
      } catch (error) {
        console.error("获取账号下载权限失败", error);
        this.accountCapabilities = { ...this.accountCapabilities, checking: false };
      }
    },
    isQualityDisabled(option) {
      if (option.unsupported) return true;
      if (this.accountCapabilities.checking) return !!(option.requiresLogin || option.requiresVip);
      if (!this.accountCapabilities.known) return !!(option.requiresLogin || option.requiresVip);
      if (option.requiresLogin && !this.accountCapabilities.loggedIn) return true;
      return !!(option.requiresVip && !this.accountCapabilities.isVip);
    },
    getQualityDisabledReason(option) {
      if (option.unsupported) return "当前网页接口暂不支持";
      if (this.accountCapabilities.checking && (option.requiresLogin || option.requiresVip)) return "正在检查账号权限";
      if (!this.accountCapabilities.known && (option.requiresLogin || option.requiresVip)) return "无法确认账号权限，请检查网络或重新登录";
      if (option.requiresLogin && !this.accountCapabilities.loggedIn) return "需要登录 Bilibili 账号";
      if (option.requiresVip && !this.accountCapabilities.isVip) return "需要 Bilibili 大会员";
      return "";
    },
    isAudioDisabled(option) {
      if (this.accountCapabilities.checking) return !!option.requiresVip;
      if (!this.accountCapabilities.known) return !!option.requiresVip;
      return !!(option.requiresVip && !this.accountCapabilities.isVip);
    },
    getAudioDisabledReason(option) {
      if (this.accountCapabilities.checking && option.requiresVip) return "正在检查账号权限";
      if (!this.accountCapabilities.known && option.requiresVip) return "无法确认账号权限，请检查网络或重新登录";
      if (option.requiresVip && !this.accountCapabilities.isVip) return "需要 Bilibili 大会员";
      return "";
    },
    saveConfig() {
      if (saveDownloadConfig(this.config)) {
        this.$message.success("默认下载配置已保存");
      } else {
        this.$message.error("保存配置失败，请检查应用存储权限");
      }
    },
    resetConfig() {
      this.config = { ...DEFAULT_DOWNLOAD_CONFIG };
      this.saveConfig();
    }
  }
};
</script>

<style scoped>
.settings-page {
  width: 100%;
  min-height: 100%;
  padding: 0 clamp(28px, 5vw, 64px) 40px;
  overflow: auto;
}

.settings-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  min-height: 112px;
  padding: 20px 0 12px;
}

.settings-header h1 {
  margin: 0;
  color: #1e2a37;
  font-size: 24px;
  font-weight: 680;
  letter-spacing: -0.035em;
}

.settings-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.settings-panel {
  padding: 0 20px;
  overflow: hidden;
  border: 1px solid #e3e8ee;
  border-radius: 11px;
  background: #fff;
}

.settings-row {
  display: flex;
  align-items: center;
  gap: 20px;
  min-height: 68px;
  border-bottom: 1px solid #edf0f4;
}

.settings-row:last-child {
  border-bottom: 0;
}

.path-row {
  min-height: 76px;
}

.setting-label {
  flex: 0 0 74px;
  color: #344150;
  font-size: 13px;
  font-weight: 600;
}

.setting-control {
  min-width: 0;
}

.path-control {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 14px;
}

.choose-path {
  flex: 0 0 auto;
  height: 34px;
  border-color: #dfe5ec;
  color: #596575;
}

.choose-path :deep(.el-icon) {
  margin-right: 6px;
}

.path-value {
  flex: 1;
  min-width: 0;
  color: #687585;
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.radio-options {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  column-gap: clamp(12px, 2.4vw, 30px);
  row-gap: 4px;
}

.radio-options :deep(.el-radio) {
  height: 32px;
  margin-right: 0;
  color: #66717e;
}

.radio-options :deep(.el-radio__label) {
  padding-left: 7px;
  font-size: 13px;
}

@media (max-width: 760px) {
  .settings-page {
    padding-bottom: 34px;
  }

  .settings-header {
    min-height: 100px;
  }

  .settings-panel {
    padding: 0 14px;
  }

  .settings-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
    padding: 14px 0;
  }

  .setting-label {
    flex-basis: auto;
  }

  .path-control,
  .radio-options {
    width: 100%;
  }

  .settings-actions {
    gap: 0;
  }
}
</style>
