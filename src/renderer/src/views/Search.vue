<template>
  <div class="search-page">
    <header class="search-intro">
      <div class="search-intro-copy">
        <div class="page-label"><span></span>视频解析</div>
        <h1>把视频带回本地</h1>
        <p>粘贴哔哩哔哩链接，选择分集与清晰度，再加入下载列表。</p>
      </div>
      <div class="media-stamp" aria-hidden="true">
        <div class="media-screen">
          <span class="play-mark"></span>
          <span class="screen-timeline"><i></i></span>
        </div>
        <span>本地媒体</span>
      </div>
    </header>

    <section class="search-panel">
      <label class="field-label" for="video-url">视频链接</label>
      <div class="search-wrapper">
        <el-icon class="link-icon"><Link /></el-icon>
        <el-input
          id="video-url"
          v-model="videoUrl"
          class="custom-input"
          clearable
          placeholder="粘贴 BV、av 或 b23.tv 链接"
          @input="change"
          @keyup.enter="search"
        ></el-input>
        <el-button class="custom-button" type="primary" @click="search">
          解析视频
        </el-button>
      </div>
      <div class="search-hint">支持哔哩哔哩视频链接与短链接</div>
    </section>

    <section v-if="pages.length > 0" class="select-wrapper">
      <div class="select-head" @click="toggleCollapse">
        <div>
          <div class="head-title">选择分集</div>
          <div class="selection-count">已选择 {{ selectedPages.length }} / {{ pages.length }}</div>
        </div>
        <el-icon :class="{'is-rotate': !isCollapsed}" class="collapse-icon">
          <ArrowDown />
        </el-icon>
      </div>
      <div v-show="!isCollapsed" class="select-content">
        <el-checkbox-group v-model="selectedPages">
          <el-checkbox
            v-for="(page, index) in pages"
            :key="index"
            :value="page.cid"
            class="page-checkbox"
          >
            <span class="part-number">P{{ index + 1 }}</span>
            <span>{{ page.part }}</span>
          </el-checkbox>
        </el-checkbox-group>
        <div class="select-actions">
          <el-checkbox
            v-model="isAllSelected"
            :indeterminate="isIndeterminate"
            class="select-all"
            @change="handleSelectAllChange"
          >
            全选分集
          </el-checkbox>
          <el-button
            :disabled="selectedPages.length === 0"
            class="next-step"
            type="primary"
            @click="getDownloadInfo"
          >
            加入下载列表
          </el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import { ArrowDown, Link } from "@element-plus/icons-vue";

export default {
  components: {
    ArrowDown,
    Link
  },
  data() {
    return {
      videoUrl: "", // 视频链接
      bgUrl: "", // 视频封面
      videoName: "", // 视频名称
      bv: "", // BV号
      avid: "", // AV号
      p: "", // 分集
      pages: [],          // 所有分集信息
      selectedPages: [],  // 选中的分集CID
      isCollapsed: false, // 是否折叠
      isAllSelected: false, // 是否全选
      isIndeterminate: false, // 是否部分选中
      audioIds: { // 音频ID对应码率
        "30280": "192K",
        "30216": "64K",
        "30232": "132K"
      },
      qualities: { // 视频清晰度
        "116": "1080P60",
        "112": "1080P+",
        "80": "1080P",
        "74": "720P60",
        "64": "720P",
        "32": "480P",
        "16": "360P"
      },
      codecNames: { // 视频码率对应名称
        "7": "AVC",
        "12": "HEVC"
      }
    };
  },
  watch: {
    // 监听选中页面的变化，更新全选状态
    selectedPages: {
      handler(val) {
        const checkedCount = val.length;
        this.isAllSelected = checkedCount === this.pages.length && checkedCount > 0;
        this.isIndeterminate = checkedCount > 0 && checkedCount < this.pages.length;
      },
      immediate: true
    },
    // 监听pages变化，重置选中状态
    pages() {
      this.updateSelectionStatus();
    }
  },
  methods: {
    // 输入变化时重置
    change() {
      this.pages = [];
      this.selectedPages = [];
      this.bgUrl = "";
      this.updateSelectionStatus();
    },

    // 搜索
    async search() {
      this.change();
      try {
        await this.parseUrl();
        if (this.bv) {
          await this.getAvidCidByBv();
          this.updateSelectionStatus();
        }
      } catch (error) {
        this.$notify.error({
          title: "解析失败",
          message: "请检查链接是否正确",
          duration: 2000
        });
      }
    },

    // 更新选择状态
    updateSelectionStatus() {
      if (this.pages.length === 0) {
        this.isAllSelected = false;
        this.isIndeterminate = false;
      } else {
        const checkedCount = this.selectedPages.length;
        this.isAllSelected = checkedCount === this.pages.length && this.pages.length > 0;
        this.isIndeterminate = checkedCount > 0 && checkedCount < this.pages.length;
      }
    },

    // 链接解析
    parseUrl() {
      return new Promise((resolve) => {
        if (this.videoUrl.includes("?p=")) {
          this.p = this.videoUrl.split("?p=")[1].split("&")[0];
          this.bv = this.videoUrl.split("/video/")[1].split("?p=")[0];
          resolve();
        } else if (this.videoUrl.includes("https://b23.tv")) {
          this.$axios.get("/move?url=" + this.videoUrl).then(resp => {
            this.videoUrl = resp.data.split(`<meta data-vue-meta="true" itemprop="url" content="`)[1].split(`/">`)[0];
            this.bv = this.videoUrl.split("/video/")[1].split("/?")[0];
            resolve();
          });
        } else {
          this.bv = this.videoUrl.split("/video/")[1].split("/?")[0];
          resolve();
        }
      });
    },

    // 获取视频基本信息
    getAvidCidByBv() {
      return new Promise((resolve) => {
        window.api.http.get(`https://api.bilibili.com/x/web-interface/view?bvid=${this.bv}`).then(resp => {
          // console.log(resp.data);
          this.videoName = resp.data.data.title;
          this.avid = resp.data.data.aid;
          this.bgUrl = resp.data.data.pic;
          this.pages = resp.data.data.pages;
          this.selectedPages = []; // 确保搜索后初始状态为空
          resolve();
        });
      });
    },

    // 处理全选变化
    handleSelectAllChange(val) {
      this.selectedPages = val ? this.pages.map(page => page.cid) : [];
    },

    // 切换折叠状态
    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed;
    },

    // 获取下载信息
    async getDownloadInfo() {
      if (this.selectedPages.length === 0) {
        this.$notify.error({
          title: "请选择分集",
          message: "请选择需要下载的分集",
          duration: 2000
        });
      } else {
        const downloadInfo = {
          avid: this.avid,
          videoName: this.videoName,
          isCompilations: this.pages.length > 1,
          pages: [],
        }
        for (let i = 0; i < this.selectedPages.length; i++) {
          const temp = this.pages.find(page => page.cid === this.selectedPages[i]);
          const pageData = {
            cid: temp.cid,
            page: temp.page,
            title: temp.part,
            pic: temp.first_frame,
            videoData: [],
            audioData: []
          }
          const { VideoData, AudioData } = await this.getDownloadUrls(pageData.cid);
          pageData.videoData = VideoData;
          pageData.audioData = AudioData;
          downloadInfo.pages.push(pageData);
        }

        // 使用新的API保存下载信息
        try {
          await window.api.storage.saveDownloadInfo(downloadInfo);
          this.$notify.success({
            title: "准备完成",
            message: `已装载 ${downloadInfo.pages.length} 个视频分P，并已保存下载信息`,
            duration: 2000
          });

          // 可选：导航到下一步
          this.$router.push('/download');
        } catch (error) {
          this.$notify.error({
            title: "保存失败",
            message: `下载信息保存失败: ${error.message}`,
            duration: 2000
          });
        }
      }
    },

    // 获取下载链接
    async getDownloadUrls(cid) {
      const res = await window.api.http.get(`https://api.bilibili.com/x/player/playurl?avid=${this.avid}&cid=${cid}&fnval=16`);
      const res_data = res.data.data;
      const VideoData = [];
      const AudioData = [];
      for (let i = 0; i < res_data.dash.video.length; i++) {
        const video = {
          label: `${this.qualities[res_data.dash.video[i].id]} | ${this.codecNames[res_data.dash.video[i].codecid]}`,
          url: res_data.dash.video[i].baseUrl
        }
        VideoData.push(video);
      }
      for (let i = 0; i < res_data.dash.audio.length; i++) {
        const audio = {
          label: this.audioIds[res_data.dash.audio[i].id],
          url: res_data.dash.audio[i].baseUrl
        }
        AudioData.push(audio);
      }
      return {
        VideoData,
        AudioData
      }
    },
  }
};
</script>

<style scoped>
.search-page {
  width: 100%;
  min-height: 100%;
  padding: 52px clamp(28px, 6vw, 76px) 48px;
  overflow: auto;
}

.search-intro,
.search-panel,
.select-wrapper {
  width: min(100%, 900px);
  margin-right: auto;
  margin-left: auto;
}

.search-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 142px;
  margin-bottom: 26px;
}

.page-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 13px;
  color: #687585;
  font-size: 12px;
}

.page-label span {
  width: 7px;
  height: 7px;
  border-radius: 2px;
  background: #fb7299;
  transform: rotate(45deg);
}

.search-intro h1 {
  margin: 0;
  color: #1e2a37;
  font-size: clamp(26px, 3vw, 34px);
  font-weight: 680;
  letter-spacing: -0.04em;
  line-height: 1.25;
}

.search-intro p {
  margin: 11px 0 0;
  color: #758292;
  font-size: 13px;
  line-height: 1.7;
}

.media-stamp {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 132px;
  margin-right: 18px;
  color: #8a96a4;
  font-size: 10px;
}

.media-screen {
  position: relative;
  display: grid;
  width: 86px;
  height: 58px;
  place-items: center;
  border: 1px solid #dbe1e8;
  border-radius: 11px;
  background: linear-gradient(145deg, #fff 0 55%, #f9e6eb 55% 100%);
  box-shadow: 0 8px 20px rgba(31, 46, 61, 0.07);
}

.media-screen::before {
  position: absolute;
  right: -7px;
  bottom: -6px;
  left: 8px;
  height: 5px;
  border: 1px solid #dbe1e8;
  border-top: 0;
  border-radius: 0 0 5px 5px;
  content: "";
}

.play-mark {
  width: 0;
  height: 0;
  margin-left: 3px;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-left: 12px solid #fb7299;
}

.screen-timeline {
  position: absolute;
  right: 10px;
  bottom: 8px;
  left: 10px;
  height: 2px;
  border-radius: 2px;
  background: #e1e5ea;
}

.screen-timeline i {
  display: block;
  width: 38%;
  height: 100%;
  border-radius: inherit;
  background: #fb7299;
}

.search-panel,
.select-wrapper {
  border: 1px solid #e3e8ee;
  border-radius: 13px;
  background: #fff;
  box-shadow: 0 10px 28px rgba(29, 42, 56, 0.035);
}

.search-panel {
  padding: 20px 22px 16px;
}

.field-label {
  display: block;
  margin-bottom: 10px;
  color: #3c4856;
  font-size: 12px;
  font-weight: 600;
}

.search-wrapper {
  display: flex;
  align-items: center;
  height: 52px;
  padding: 4px;
  border: 1px solid #dce2e8;
  border-radius: 9px;
  background: #fff;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.search-wrapper:focus-within {
  border-color: #fb7299;
  box-shadow: 0 0 0 3px rgba(251, 114, 153, 0.11);
}

.link-icon {
  flex: 0 0 auto;
  margin: 0 9px 0 11px;
  color: #8995a2;
  font-size: 17px;
}

.custom-input {
  flex: 1;
  min-width: 0;
  height: 100%;
}

.search-wrapper :deep(.el-input__wrapper) {
  padding: 0 4px;
  border: 0;
  background: transparent;
  box-shadow: none !important;
}

.search-wrapper :deep(.el-input__inner) {
  height: 42px;
  color: #273442;
  font-size: 13px;
}

.search-wrapper :deep(.el-input__inner::placeholder) {
  color: #a0a9b4;
}

.custom-button {
  height: 42px;
  padding: 0 21px;
  border: 0;
  border-radius: 7px;
  font-weight: 600;
  box-shadow: 0 3px 8px rgba(251, 114, 153, 0.2);
}

.search-hint {
  margin: 9px 0 0 2px;
  color: #929daa;
  font-size: 11px;
}

.select-wrapper {
  margin-top: 16px;
  overflow: hidden;
}

.select-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  padding: 12px 20px;
  cursor: pointer;
  user-select: none;
}

.head-title {
  color: #2b3745;
  font-size: 13px;
  font-weight: 650;
}

.selection-count {
  margin-top: 4px;
  color: #85919e;
  font-size: 11px;
}

.collapse-icon {
  color: #85919e;
  transition: transform 180ms ease;
}

.collapse-icon.is-rotate {
  transform: rotate(180deg);
}

.select-content {
  padding: 0 20px 16px;
  border-top: 1px solid #edf0f3;
}

.el-checkbox-group {
  display: flex;
  flex-direction: column;
  max-height: 250px;
  margin: 10px 0 12px;
  overflow-y: auto;
}

.page-checkbox {
  display: flex;
  width: 100%;
  min-height: 38px;
  margin: 0;
  border-bottom: 1px solid #f0f2f5;
}

.page-checkbox :deep(.el-checkbox__label) {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
  color: #4f5c6b;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.part-number {
  color: #9aa4af;
  font-size: 10px;
  font-weight: 650;
}

.select-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 13px;
}

.select-all {
  color: #596575;
}

.next-step {
  min-height: 36px;
  padding: 0 17px;
  font-size: 12px;
}

@media (max-width: 760px) {
  .search-page {
    padding: 34px 22px;
  }

  .media-stamp {
    display: none;
  }

  .search-intro {
    min-height: 120px;
  }

  .search-panel {
    padding-right: 14px;
    padding-left: 14px;
  }

  .custom-button {
    padding: 0 12px;
  }
}
</style>
