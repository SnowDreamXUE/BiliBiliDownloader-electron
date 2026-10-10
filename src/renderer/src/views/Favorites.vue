<template>
  <div class="favorites-page">
    <header class="favorites-header">
      <h1>收藏夹</h1>
      <div v-if="loggedIn && account.uname" class="account-label">
        <img v-if="account.face" :src="account.face" alt="" @error="account.face = ''" />
        <span>{{ account.uname }}</span>
      </div>
    </header>

    <section v-if="checkingLogin" class="state-panel">正在检查登录状态…</section>

    <section v-else-if="!loggedIn" class="state-panel login-panel">
      <p>{{ loginMessage || "登录 Bilibili 账号后，可以浏览自己的收藏夹并添加视频下载。" }}</p>
      <el-button type="primary" @click="$router.push('/login')">前往登录</el-button>
    </section>

    <template v-else>
      <section class="folder-toolbar">
        <el-select
          v-model="selectedFolderId"
          class="folder-select"
          placeholder="选择收藏夹"
          :loading="loadingFolders"
          :disabled="folders.length === 0 || loadingMedia || loadingMore || loadingAll || preparing"
          @change="handleFolderChange"
        >
          <el-option
            v-for="folder in folders"
            :key="folder.id"
            :label="`${folder.title} · ${folder.media_count ?? 0}`"
            :value="String(folder.id)"
          />
        </el-select>
        <div class="folder-actions">
          <el-button
            :loading="loadingAll"
            :disabled="!selectedFolderId || !hasMore || loadingFolders || loadingMedia || loadingMore || preparing"
            @click="loadAllVideos"
          >
            {{ loadingAll ? `已加载 ${videos.length} 个` : hasMore ? "加载全部视频" : "已全部加载" }}
          </el-button>
          <el-button
            :loading="loadingFolders"
            :disabled="loadingMedia || loadingMore || loadingAll || preparing"
            @click="loadAccountAndFolders"
          >
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </section>

      <section v-if="loadError && folders.length === 0 && !loadingFolders" class="state-panel login-panel">
        <p>{{ loadError }}</p>
        <el-button @click="loadAccountAndFolders">重试</el-button>
      </section>
      <section v-else-if="folders.length === 0 && !loadingFolders" class="state-panel">
        暂无可用收藏夹
      </section>

      <section v-else-if="selectedFolderId" class="favorite-panel">
        <header class="list-toolbar">
          <span class="selection-count">已选择 {{ selectedVideoIds.length }} 个视频</span>
          <div class="list-actions">
            <el-button text @click="toggleCurrentPageSelection">
              {{ isCurrentPageSelected ? "取消全选" : "全选当前列表" }}
            </el-button>
            <el-button
              type="primary"
              :disabled="selectedVideoIds.length === 0 || preparing || loadingAll"
              :loading="preparing"
              @click="addSelectedVideos"
            >
              {{ preparing ? `准备中 ${prepareProgress}` : "加入待下载" }}
            </el-button>
          </div>
        </header>

        <div v-if="loadError" class="list-state error-state">
          <span>{{ loadError }}</span>
          <el-button text type="primary" @click="videos.length ? loadMoreVideos() : loadFolderMedia(true)">重试</el-button>
        </div>
        <div v-if="loadingMedia && videos.length === 0" class="list-state">
          正在加载收藏视频…
        </div>
        <div v-else-if="videos.length === 0 && !loadError" class="list-state">这个收藏夹里还没有视频</div>

        <el-checkbox-group v-if="videos.length > 0" v-model="selectedVideoIds" class="favorite-list">
          <el-checkbox
            v-for="video in videos"
            :key="getVideoKey(video)"
            :value="getVideoKey(video)"
            :disabled="!isDownloadable(video)"
            class="favorite-item"
          >
            <div class="item-cover">
              <img :src="video.cover || video.pic" alt="视频封面" @error="handleImageError" />
              <span v-if="video.duration" class="duration">{{ formatDuration(video.duration) }}</span>
            </div>
            <div class="item-info">
              <div class="item-title" :title="video.title">{{ video.title || "已失效的视频" }}</div>
              <div class="item-meta">
                <span>{{ video.upper?.name || "未知UP主" }}</span>
                <span v-if="video.page && video.page > 1">{{ video.page }}P</span>
              </div>
            </div>
          </el-checkbox>
        </el-checkbox-group>

        <footer v-if="videos.length > 0" class="list-footer">
          <span>已加载 {{ videos.length }} 个视频</span>
          <el-button v-if="hasMore" :loading="loadingMore" :disabled="loadingAll" @click="loadMoreVideos">
            加载更多
          </el-button>
          <span v-else class="end-hint">已显示全部视频</span>
        </footer>
      </section>
    </template>
  </div>
</template>

<script>
import { Refresh } from "@element-plus/icons-vue";
import { fetchBilibiliData, fetchVideoDownloadInfo } from "../utils/videoDownload";

const FAVORITE_FOLDER_API = "https://api.bilibili.com/x/v3/fav/folder/created/list-all";
const FAVORITE_RESOURCE_API = "https://api.bilibili.com/x/v3/fav/resource/list";
const PAGE_SIZE = 20;

export default {
  components: { Refresh },
  data() {
    return {
      checkingLogin: true,
      loggedIn: false,
      loginMessage: "",
      account: { uname: "", face: "" },
      folders: [],
      selectedFolderId: "",
      loadingFolders: false,
      videos: [],
      selectedVideoIds: [],
      page: 0,
      hasMore: false,
      loadingMedia: false,
      loadingMore: false,
      loadingAll: false,
      loadError: "",
      preparing: false,
      prepareProgress: ""
    };
  },
  computed: {
    selectedFolder() {
      return this.folders.find(folder => String(folder.id) === this.selectedFolderId);
    },
    isCurrentPageSelected() {
      const downloadableVideos = this.videos.filter(video => this.isDownloadable(video));
      return downloadableVideos.length > 0 && downloadableVideos.every(video =>
        this.selectedVideoIds.includes(this.getVideoKey(video))
      );
    }
  },
  mounted() {
    this.loadAccountAndFolders();
  },
  methods: {
    async loadAccountAndFolders() {
      this.loadingFolders = true;
      this.loginMessage = "";
      try {
        const hasSession = await window.api.isLoggedIn();
        if (!hasSession) {
          this.loggedIn = false;
          return;
        }

        const account = await fetchBilibiliData(
          "https://api.bilibili.com/x/web-interface/nav",
          {},
          "读取登录状态"
        );
        if (!account.isLogin) {
          this.loggedIn = false;
          return;
        }

        this.loggedIn = true;
        this.account = { uname: account.uname || "", face: account.face || "" };
        const data = await fetchBilibiliData(FAVORITE_FOLDER_API, { up_mid: account.mid }, "读取收藏夹");
        this.folders = Array.isArray(data.list) ? data.list : [];

        if (!this.folders.some(folder => String(folder.id) === this.selectedFolderId)) {
          this.selectedFolderId = this.folders.length ? String(this.folders[0].id) : "";
          if (this.selectedFolderId) await this.loadFolderMedia(true);
          else this.resetMedia();
        } else {
          await this.loadFolderMedia(true);
        }
      } catch (error) {
        console.error("加载收藏夹失败", error);
        this.loadError = error.message || "读取收藏夹失败";
        if (/登录|login|\-101/i.test(this.loadError)) {
          this.loggedIn = false;
          this.loginMessage = "登录状态已失效，请重新登录 Bilibili 账号。";
        }
      } finally {
        this.checkingLogin = false;
        this.loadingFolders = false;
      }
    },

    async handleFolderChange() {
      await this.loadFolderMedia(true);
    },

    resetMedia() {
      this.videos = [];
      this.selectedVideoIds = [];
      this.page = 0;
      this.hasMore = false;
      this.loadError = "";
    },

    async loadFolderMedia(reset = false) {
      if (!this.selectedFolderId || this.loadingMedia || this.loadingMore) return;
      const nextPage = reset ? 1 : this.page + 1;
      if (reset) {
        this.resetMedia();
        this.loadingMedia = true;
      } else {
        this.loadingMore = true;
      }

      try {
        const data = await fetchBilibiliData(FAVORITE_RESOURCE_API, {
          media_id: this.selectedFolderId,
          pn: nextPage,
          ps: PAGE_SIZE,
          order: "mtime",
          type: 0,
          tid: 0,
          platform: "web"
        }, "读取收藏视频");
        const items = Array.isArray(data.medias) ? data.medias : [];
        const videos = items.filter(item => item && (item.type == null || Number(item.type) === 2));
        const knownKeys = new Set(this.videos.map(video => this.getVideoKey(video)));
        this.videos.push(...videos.filter(video => {
          const key = this.getVideoKey(video);
          if (knownKeys.has(key)) return false;
          knownKeys.add(key);
          return true;
        }));
        this.page = nextPage;
        if (typeof data.has_more === "boolean") {
          this.hasMore = data.has_more;
        } else {
          const total = Number(data.info?.media_count ?? this.selectedFolder?.media_count ?? 0);
          this.hasMore = items.length === PAGE_SIZE && (!total || nextPage * PAGE_SIZE < total);
        }
        this.loadError = "";
      } catch (error) {
        console.error("加载收藏视频失败", error);
        this.loadError = error.message || "读取收藏视频失败";
      } finally {
        this.loadingMedia = false;
        this.loadingMore = false;
      }
    },

    async loadMoreVideos() {
      await this.loadFolderMedia(false);
    },

    async loadAllVideos() {
      if (!this.selectedFolderId || !this.hasMore || this.loadingAll) return;
      const folderId = this.selectedFolderId;
      this.loadingAll = true;
      try {
        while (this.hasMore && this.selectedFolderId === folderId) {
          const previousPage = this.page;
          await this.loadFolderMedia(false);
          if (this.loadError || this.page <= previousPage) break;
        }
      } finally {
        this.loadingAll = false;
      }
    },

    getVideoKey(video) {
      return String(video.bvid || video.aid || video.id || "");
    },

    isDownloadable(video) {
      return Boolean(video.bvid || video.aid || video.id);
    },

    toggleCurrentPageSelection() {
      const currentKeys = this.videos
        .filter(video => this.isDownloadable(video))
        .map(video => this.getVideoKey(video));
      if (this.isCurrentPageSelected) {
        this.selectedVideoIds = this.selectedVideoIds.filter(key => !currentKeys.includes(key));
      } else {
        this.selectedVideoIds = [...new Set([...this.selectedVideoIds, ...currentKeys])];
      }
    },

    async addSelectedVideos() {
      const selected = this.videos.filter(video => this.selectedVideoIds.includes(this.getVideoKey(video)));
      if (!selected.length) return;

      this.preparing = true;
      let addedCount = 0;
      const failures = [];
      try {
        for (let index = 0; index < selected.length; index++) {
          const media = selected[index];
          this.prepareProgress = `${index + 1}/${selected.length}`;
          try {
            const downloadInfo = await fetchVideoDownloadInfo(media);
            await window.api.storage.saveDownloadInfo(downloadInfo);
            addedCount++;
          } catch (error) {
            console.error(`准备收藏视频失败: ${media.title}`, error);
            failures.push(media.title || "未命名视频");
          }
        }

        if (addedCount > 0) {
          const failureMessage = failures.length ? `，${failures.length} 个视频无法添加` : "";
          this.$message.success(`已添加 ${addedCount} 个视频到待下载列表${failureMessage}`);
          this.$router.push("/download/waiting");
        } else {
          this.$message.error(failures.length ? `无法添加所选视频：${failures[0]}` : "没有可添加的视频");
        }
      } finally {
        this.preparing = false;
        this.prepareProgress = "";
      }
    },

    formatDuration(seconds) {
      const minutes = Math.floor(Number(seconds) / 60);
      const remainingSeconds = Number(seconds) % 60;
      return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
    },

    handleImageError(event) {
      event.target.style.visibility = "hidden";
    }
  }
};
</script>

<style scoped>
.favorites-page {
  width: 100%;
  min-height: 100%;
  padding: 0 clamp(28px, 5vw, 64px) 40px;
  overflow: auto;
}

.favorites-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  min-height: 112px;
  padding-top: 20px;
}

.favorites-header h1 {
  margin: 0 0 12px;
  color: #1e2a37;
  font-size: 24px;
  font-weight: 680;
  letter-spacing: -0.035em;
}

.account-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  color: #657181;
  font-size: 12px;
}

.account-label img {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

.folder-toolbar,
.favorite-panel,
.state-panel {
  border: 1px solid #e3e8ee;
  border-radius: 11px;
  background: #fff;
}

.folder-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
}

.folder-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.folder-select {
  width: min(380px, 100%);
}

.favorite-panel {
  margin-top: 14px;
  overflow: hidden;
}

.list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 58px;
  padding: 10px 16px;
  border-bottom: 1px solid #edf0f3;
}

.selection-count,
.list-footer {
  color: #7e8996;
  font-size: 12px;
}

.list-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.favorite-list {
  display: flex;
  flex-direction: column;
  padding: 0 16px;
}

.favorite-item {
  display: flex;
  width: 100%;
  min-height: 96px;
  margin: 0;
  padding: 11px 0;
  border-bottom: 1px solid #f0f2f5;
}

.favorite-item:last-child {
  border-bottom: 0;
}

.favorite-item :deep(.el-checkbox__input) {
  align-self: center;
}

.favorite-item :deep(.el-checkbox__label) {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  padding-left: 12px;
}

.item-cover {
  position: relative;
  width: 136px;
  height: 76px;
  flex: 0 0 136px;
  overflow: hidden;
  border-radius: 6px;
  background: #f1f3f6;
}

.item-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.duration {
  position: absolute;
  right: 5px;
  bottom: 5px;
  padding: 2px 4px;
  border-radius: 3px;
  color: #fff;
  background: rgba(17, 27, 38, 0.72);
  font-size: 10px;
}

.item-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  padding-left: 14px;
}

.item-title {
  display: -webkit-box;
  overflow: hidden;
  color: #303c49;
  font-size: 13px;
  font-weight: 550;
  line-height: 1.55;
  text-overflow: ellipsis;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.item-meta {
  display: flex;
  gap: 14px;
  margin-top: 7px;
  color: #929ca7;
  font-size: 11px;
}

.list-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 54px;
  padding: 8px 16px;
  border-top: 1px solid #edf0f3;
}

.end-hint {
  color: #a1aab4;
}

.state-panel,
.list-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 156px;
  padding: 24px;
  color: #87929f;
  font-size: 13px;
  text-align: center;
}

.login-panel {
  flex-direction: column;
}

.login-panel p {
  margin: 0;
}

.list-state.error-state {
  flex-direction: column;
  color: #c45d71;
}

@media (max-width: 760px) {
  .favorites-page {
    padding-right: 20px;
    padding-left: 20px;
  }

  .list-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .list-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .item-cover {
    width: 104px;
    height: 59px;
    flex-basis: 104px;
  }
}
</style>
