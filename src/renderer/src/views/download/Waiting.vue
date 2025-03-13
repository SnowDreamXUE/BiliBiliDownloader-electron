<template>
  <div class="download-wrapper">
    <div v-if="downloadInfo.length === 0" class="no-data">
      <div>啥也没有</div>
      <div>no-data</div>
    </div>
    <div v-else class="download-list">
      <div class="download-action">
        <el-button>选择下载路径</el-button>
        <el-button>全部下载</el-button>
        <el-button>清空</el-button>
      </div>
      <div class="download-info">
        <!-- 遍历每个视频的页面 -->
        <div v-for="(video, videoIndex) in downloadInfo" :key="'video-'+videoIndex" class="download-page">
          <div v-for="item in video.pages" :key="item.cid" class="download-item">
            <div class="video-pic">
              <img :src="item.pic" alt="封面" />
            </div>
            <div class="video-info">
              <div class="download-item-top">
                <div class="video-title">{{ item.title }}</div>
                <div class="video-action">
                  <el-button size="small" type="primary">
                    封面
                  </el-button>
                  <el-button size="small" type="primary">
                    音频
                  </el-button>
                  <el-button size="small" type="primary">
                    视频
                  </el-button>
                </div>
              </div>
              <div class="video-select">
                <div class="audio-quality">
                  <div class="select-span">音质</div>
                  <el-select
                    class="select-quality"
                    placeholder="选择音频码率"
                    size="small"
                    v-model="selectedAudio[item.cid]"
                  >
                    <el-option
                      v-for="(audio, index) in item.audioData"
                      :key="'audio-'+item.cid+'-'+index"
                      :label="audio.label"
                      :value="audio.url"
                    ></el-option>
                  </el-select>
                </div>

                <div class="video-quality">
                  <div class="select-span">画质</div>
                  <el-select
                    class="select-quality"
                    placeholder="选择清晰度"
                    size="small"
                    v-model="selectedVideo[item.cid]"
                  >
                    <el-option
                      v-for="(video, index) in item.videoData"
                      :key="'video-'+item.cid+'-'+index"
                      :label="video.label"
                      :value="video.url"
                    ></el-option>
                  </el-select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      downloadInfo: [], // 下载信息
      selectedVideo: {}, // 存储选中的视频质量
      selectedAudio: {} // 存储选中的音频质量
    };
  },

  mounted() {
    this.init();
  },

  methods: {
    // 从JSON中获取数据
    async init() {
      try {
        this.downloadInfo = await window.api.storage.getDownloadsInfo();

        // 初始化默认选中的音视频
        this.downloadInfo.forEach(video => {
          video.pages.forEach(page => {
            if (page.videoData && page.videoData.length > 0) {
              this.selectedVideo[page.cid] = page.videoData[0].url;
            }
            if (page.audioData && page.audioData.length > 0) {
              this.selectedAudio[page.cid] = page.audioData[0].url;
            }
          });
        });
      } catch (error) {
        console.error("获取下载信息失败", error);
      }
    }
  }
};
</script>

<style scoped>
/* 全局滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f5f7fa;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #a0cffd;
  border-radius: 4px;
  transition: background 0.3s;
}

::-webkit-scrollbar-thumb:hover {
  background: #60acfa;
}

::-webkit-scrollbar-corner {
  background: #f5f7fa;
}

/* Firefox滚动条样式 */
* {
  scrollbar-width: thin;
  scrollbar-color: #a0cffd #f5f7fa;
}
.download-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: calc(100vh - 100px);
  overflow-y: auto;
}

.no-data {
  font-weight: bold;
  font-size: 16px;
  color: #999;
}

.download-list {
  width: 100%;
  height: 100%;
}

.download-info {
  margin-top: 50px;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding-bottom: 50px;
}

.download-action {
  padding: 10px;
  position: fixed;
  height: 30px;
  width: calc(100% - 60px);
  background: #fff;
  z-index: 10;
}

.download-page {
  width: calc(100% - 60px);
}
.download-item {
  height: 100px;
  border: 2px solid #60acfa;
  border-radius: 10px;
  margin: 5px 0;
  padding: 10px;
  display: flex;
  justify-items: center;
}

.video-pic {
  margin-right: 10px;
}

.video-pic img {
  height: 100px;
  object-fit: cover;
  border-radius: 6px;
}

.video-info {
  width: calc(100% - 130px);
}

.video-title {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  max-width: 70%;
}

.download-item-top {
  display: flex;
  justify-content: space-between;
}

.video-select {
  display: flex;
  justify-content: left;
  justify-items: center;
  margin-top: 10px;
}

.audio-quality,
.video-quality {
  display: flex;
  justify-content: space-between;
  justify-items: center;
}

.select-span {
  display: flex;
  justify-items: center;
  align-items: center;
  width: 30px;
  font-size: small;
  margin-right: 5px;
}

.select-quality {
  width: 120px;
  margin-right: 20px;
}
</style>
