import { defineStore } from 'pinia';

export const useVideoStore = defineStore('video', {
  state: () => ({
    selectedCids: [],          // 选中的分集CID数组
    avid: '',                  // AV号
    videoName: '',             // 视频名称
    bgUrl: '',                 // 视频封面
    selectedPageDetails: []    // 选中的分P详细信息，包含cid和title
  }),

  getters: {
    getSelectedCids: (state) => state.selectedCids,
    getAvid: (state) => state.avid,
    getVideoName: (state) => state.videoName,
    getBgUrl: (state) => state.bgUrl,
    getSelectedPageDetails: (state) => state.selectedPageDetails,

    // 根据CID获取标题
    getTitleByCid: (state) => (cid) => {
      const page = state.selectedPageDetails.find(page => page.cid === cid);
      return page ? page.title : '';
    }
  },

  actions: {
    // 单独的setter方法
    setSelectedCids(cids) {
      this.selectedCids = cids;
    },

    setAvid(avid) {
      this.avid = avid;
    },

    setVideoName(name) {
      this.videoName = name;
    },

    setBgUrl(url) {
      this.bgUrl = url;
    },

    setSelectedPageDetails(details) {
      this.selectedPageDetails = details;
    },

    // 一次性设置所有数据
    setAllVideoData({ selectedPages, avid, videoName, bgUrl, pageDetails }) {
      // 更新变量名后的映射
      this.selectedCids = selectedPages || this.selectedCids;
      this.avid = avid || this.avid;
      this.videoName = videoName || this.videoName;
      this.bgUrl = bgUrl || this.bgUrl;

      // 只保存选中的页面详情
      if (pageDetails) {
        this.selectedPageDetails = pageDetails.filter(page =>
          this.selectedCids.includes(page.cid)
        );
      }
    },

    // 根据cid移除选中的分P
    removePageByCid(cid) {
      // 从selectedCids中移除
      this.selectedCids = this.selectedCids.filter(pageCid => pageCid !== cid);

      // 同步从selectedPageDetails中移除
      this.selectedPageDetails = this.selectedPageDetails.filter(page => page.cid !== cid);
    },

    // 批量根据cid移除选中的分P
    removePagesById(cidArray) {
      if (!Array.isArray(cidArray)) return;

      // 从selectedCids中批量移除
      this.selectedCids = this.selectedCids.filter(pageCid => !cidArray.includes(pageCid));

      // 同步从selectedPageDetails中批量移除
      this.selectedPageDetails = this.selectedPageDetails.filter(page => !cidArray.includes(page.cid));
    },

    // 添加单个页面到选中状态
    addSelectedPage(cid, title) {
      // 确保CID不重复
      if (!this.selectedCids.includes(cid)) {
        this.selectedCids.push(cid);

        // 同时添加详情
        if (title) {
          this.selectedPageDetails.push({ cid, title });
        }
      }
    },

    // 更新页面标题
    updatePageTitle(cid, newTitle) {
      const pageIndex = this.selectedPageDetails.findIndex(page => page.cid === cid);
      if (pageIndex !== -1) {
        this.selectedPageDetails[pageIndex].title = newTitle;
      }
    },

    // 清空所有数据
    clearAll() {
      this.selectedCids = [];
      this.avid = '';
      this.videoName = '';
      this.bgUrl = '';
      this.selectedPageDetails = [];
    },

    // 仅清空选择，保留其他信息
    clearSelection() {
      this.selectedCids = [];
      this.selectedPageDetails = [];
    }
  }
});
