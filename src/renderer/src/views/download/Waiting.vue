<template>
  <div class="download-wrapper">
    <div v-if="downloadUrls.length === 0" class="no-data">
      <div>啥也没有</div>
      <div>no-data</div>
    </div>
    <div v-else class="download-list">
      <div class="download-action">
        <el-button>存储 {{}}</el-button>
        <el-button>全部下载</el-button>
        <el-button>清空</el-button>
      </div>
      <div class="download-info">
        <div v-for="item in downloadUrls" :key="item.cid" class="download-item">
          <div class="video-pic">
            <img :src="pic" alt="封面" />
          </div>
          <div class="video-info">
            <div class="download-item-top">
              <div class="video-title">{{ item.title }}</div>
              <div class="video-action">
                <el-button
                  size="small" type="primary"
                >
                  封面
                </el-button>
                <el-button
                  size="small" type="primary"
                >
                  音频
                </el-button>
                <el-button
                  size="small" type="primary"
                >
                  视频
                </el-button>
              </div>
            </div>
            <div class="video-select">
              <div class="audio-quality">
                <div class="select-span">音质</div>
                <el-select
                  v-model="item.audioId"
                  :disabled="item.status === 'downloading'"
                  class="select-quality"
                  placeholder="选择音频码率"
                  size="small"
                  @change="selectDownloadFormat(item)"
                >
                  <el-option
                    v-for="(value, key) in audioIds"
                    :key="key"
                    :label="value"
                    :value="key"
                  ></el-option>
                </el-select>
              </div>

              <div class="video-quality">
                <div class="select-span">画质</div>
                <el-select
                  v-model="item.videoKey"
                  :disabled="item.status === 'downloading'"
                  class="select-quality"
                  placeholder="选择清晰度"
                  size="small"
                  @change="selectDownloadFormat(item)"
                >
                  <el-option
                    v-for="video in filteredVideos(item)"
                    :key="`${video.id}_${video.codecid}`"
                    :label="getQualityLabel(video)"
                    :value="`${video.id}_${video.codecid}`"
                  ></el-option>
                </el-select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useVideoStore } from "../../stores/videoStore";

export default {
  data() {
    return {
      downloadUrls: [],   // 分集下载链接
      pic: "", // 视频封面
      avid: "", // av号
      selectedCids: [], // 选中的cid
      selectedPageDetails: [], // 选中的分集详情
      audioIds: { // 音频码率
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
      codecNames: { // 视频编码格式
        7: "AVC",
        12: "HEVC"
      }
    };
  },

  mounted() {
    this.init();
    this.fetchDownloadUrls();
  },

  methods: {
    // 初始化数据，从store中获取
    init() {
      const videoStore = useVideoStore();
      this.pic = videoStore.bgUrl;
      this.avid = videoStore.avid;
      this.selectedCids = videoStore.selectedCids;
      this.selectedPageDetails = videoStore.selectedPageDetails;
    },

    // 获取下载链接
    async fetchDownloadUrls() {
      this.downloadUrls = [];
      try {
        // 获取所有选中分集的下载链接
        const promises = this.selectedCids.map(cid => {
          return this.getDownloadUrl(cid);
        });

        await Promise.all(promises);
      } catch (error) {
        this.$notify.error({
          title: "获取下载链接失败",
          message: error.message,
          duration: 3000
        });
      }
    },

    // 获取下载链接
    async getDownloadUrl(cid) {
      try {
        const res = await window.api.http.get(`https://api.bilibili.com/x/player/playurl?avid=${this.avid}&cid=${cid}&fnval=16`);
        // console.log(res.data);

        const res_data = res.data.data;
        // 获取支持的清晰度列表
        const supportedQualities = res_data.accept_quality.map(String);

        // 初始化视频流选择
        const firstVideo = res_data.dash.video[0];
        const item = {
          cid,
          videoData: res_data.dash.video,
          audioData: res_data.dash.audio,
          title: this.selectedPageDetails.find(item => item.cid === cid).title,
          supportedQualities,
          videoKey: `${firstVideo.id}_${firstVideo.codecid}`,
          audioId: String(res.data.data.dash.audio[0]?.id || ""),
          videoUrl: "",
          audioUrl: ""
        };
        this.downloadUrls.push(item);
        this.selectDownloadFormat(item);
      } catch (error) {
        this.$notify.error({
          title: "获取链接失败",
          message: `CID:${cid} 请求过程中发生错误`,
          duration: 3000
        });
      }
    },

    // 获取视频质量标签
    getQualityLabel(video) {
      const qualityName = this.qualities[video.id] || video.id;
      const codecName = this.codecNames[video.codecid] || `Codec ${video.codecid}`;
      return `${qualityName} ${codecName}`;
    },

    // 过滤支持的视频流
    filteredVideos(item) {
      return item.videoData.filter(video =>
        item.supportedQualities.includes(String(video.id))
      );
    },

    // 选择下载的格式
    selectDownloadFormat(item) {
      if (!item.videoKey) return;

      const [id, codecid] = item.videoKey.split("_");
      const videoObj = item.videoData.find(v =>
        String(v.id) === id && String(v.codecid) === codecid
      );

      if (videoObj) {
        item.videoUrl = videoObj.baseUrl;
      } else {
        this.$notify.error({
          title: "错误",
          message: "无法找到对应的视频流"
        });
      }

      // 处理音频部分（保持原逻辑）
      const audioObj = item.audioData.find(a => String(a.id) === item.audioId);
      item.audioUrl = audioObj?.baseUrl;
      if (!item.audioUrl) {
        this.$notify.error({
          title: "获取音频失败",
          message: `CID:${item.cid} 音频码率不可用`
        });
      }
    }
  }


};
</script>

<style scoped>
.download-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: calc(100vh - 100px);
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
  height: calc(100% - 60px);
  width: 100%;
}

.download-action {
  padding: 10px;
  position: fixed;
  height: 30px;
  width: calc(100% - 60px);
  background: #fff;
}

.download-item {
  width: calc(100% - 60px);
  height: 100px;
  border: 2px solid #60acfa;
  border-radius: 10px;
  margin: 3px 0;
  padding: 10px;
  display: flex;
  justify-items: center;
}

.video-pic {
  margin-right: 10px;
  img {
    height: 100px;
    object-fit: cover;
    border-radius: 6px;
  }
}

.video-info {
  width: calc(100% - 130px);
}

.download-item-top {
  display: flex;
  justify-content: space-between;
}

.video-select {
  display: flex;
  justify-content: left;
  justify-items: center;

  .audio-quality,
  .video-quality {
    display: flex;
    justify-content: space-between;
    justify-items: center;

    .select-span {
      display: flex;
      justify-items: center;
      align-items: center;
      width: 30px;
      font-size: small;
      margin-right: 5px;
    }
  }
}

.select-quality {
  width: 120px;
  margin-right: 20px;
}

</style>
