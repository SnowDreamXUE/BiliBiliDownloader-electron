<template>
  <div class="search">
    <div class="search-wrapper">
      <el-input
        v-model="videoUrl"
        class="custom-input"
        clearable
        placeholder="请输入链接"
        @input="change"
      ></el-input>
      <el-button
        class="custom-button"
        type="primary"
        @click="search"
      >搜索
      </el-button>
    </div>
    <div v-show="pages.length > 0" class="select-wrapper">
      <div class="select-head" @click="toggleCollapse">
        <div class="head-title">已选择[{{ selectedPages.length }} / {{ pages.length }}]</div>
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
            {{ page.part }} (P{{ index + 1 }})
          </el-checkbox>
        </el-checkbox-group>
        <div class="select-actions">
          <el-checkbox
            v-model="isAllSelected"
            :indeterminate="isIndeterminate"
            class="select-all"
            @change="handleSelectAllChange"
          >
            全选
          </el-checkbox>
          <el-button
            :disabled="selectedPages.length === 0"
            class="next-step"
            type="primary"
            @click="getDownloadInfo"
          >
            下一步
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ArrowDown } from "@element-plus/icons-vue";

export default {
  components: {
    ArrowDown
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
          // this.$router.push('/download');
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
/* 保持原有样式不变 */
.search {
  padding: 0 20px;
  display: flex;
  align-items: center;
  flex-direction: column;
  width: calc(100% - 40px);
  height: 100%;
}

.search-wrapper {
  margin-top: 150px;
  width: 43%;
  min-width: 400px;
  height: 40px; /* 增加整体高度 */
  display: flex;
  border: 2px solid #DCDFE6;
  border-radius: 6px; /* 增大圆角 */
  position: relative;
  background: #fff;
}

.search-wrapper:focus-within {
  border-color: #60acfa;
}

.custom-input {
  flex: 1;
  height: 100%;
}

/* 调整输入框内部样式 */
.search-wrapper :deep(.el-input__wrapper) {
  box-shadow: none !important;
  border: none !important;
  height: 100%;
  padding: 0 15px;
}

.search-wrapper :deep(.el-input__inner) {
  border: none !important;
  height: 100% !important;
  line-height: 40px; /* 保持文字垂直居中 */
}

.custom-button {
  height: calc(100% - 6px) !important; /* 高度减少6px */
  margin: 3px 3px 3px 0; /* 添加外边距 */
  border-radius: 4px !important;
  background: #409EFF;
  color: white;
  transition: all 0.3s;
  font-size: 13px;
  font-weight: bold;
}

.custom-button:hover {
  background: #66b1ff;
  border-color: #66b1ff !important;
}

/* 下拉选择区域样式 */
.select-wrapper {
  width: 43%;
  min-width: 400px;
  margin-top: 20px;
  border: 1px solid #DCDFE6;
  border-radius: 6px;
  background: #fff;
}

.select-head {
  padding: 12px 15px;
  background: #f5f7fa;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
  font-weight: bold;
  color: #606266;
}

.head-title {
  font-size: 14px;
}

.collapse-icon {
  font-size: 16px;
  transition: transform 0.3s;
}

.is-rotate {
  transform: rotate(180deg);
}

.select-content {
  padding: 15px;
}

/* 复选框组样式 */
.el-checkbox-group {
  display: flex;
  flex-direction: column;
  max-height: 250px;
  overflow-y: auto;
  margin-bottom: 15px;
  padding-right: 5px;
}

/* 单个复选框样式 */
.page-checkbox {
  margin: 5px 0;
  display: block;
  width: 100%;
}

/* 底部操作区域 */
.select-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid #EBEEF5;
}

/* 全选样式 */
.select-all {
  margin-right: auto;
}

/* 下一步按钮 */
.next-step {
  margin-left: auto;
}

/* 滚动条样式 */
.el-checkbox-group::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.el-checkbox-group::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 3px;
}

.el-checkbox-group::-webkit-scrollbar-track {
  background: #f5f7fa;
  border-radius: 3px;
}
</style>
