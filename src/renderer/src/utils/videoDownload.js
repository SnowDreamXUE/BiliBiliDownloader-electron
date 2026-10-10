function getResponseData(response, action) {
  if (response?.error) {
    throw new Error(response.error.message || `${action}请求失败`);
  }

  const result = response?.data;
  if (!result || Number(result.code) !== 0 || !result.data) {
    throw new Error(result?.message || result?.msg || `${action}失败（${result?.code ?? "无响应"}）`);
  }

  return result.data;
}

export async function fetchBilibiliData(url, params, action = "Bilibili API") {
  const response = await window.api.http.get(url, params, {
    Referer: "https://www.bilibili.com/"
  });
  return getResponseData(response, action);
}

export async function fetchDownloadStreams(avid, cid) {
  const data = await fetchBilibiliData(
    "https://api.bilibili.com/x/player/playurl",
    { avid, cid, fnval: 4048, fourk: 1 },
    "获取视频下载地址"
  );
  const dash = data.dash || {};
  const videoLabels = {
    6: "240P",
    16: "360P",
    32: "480P",
    64: "720P",
    74: "720P60",
    80: "1080P",
    100: "智能修复",
    112: "1080P+",
    116: "1080P60",
    120: "4K",
    125: "HDR",
    126: "杜比视界",
    127: "8K",
    129: "HDR Vivid"
  };
  const codecNames = { 7: "AVC", 12: "HEVC", 13: "AV1" };
  const videoData = (dash.video || []).map(stream => ({
    label: `${videoLabels[stream.id] || `${stream.id}P`} | ${codecNames[stream.codecid] || "未知编码"}`,
    url: stream.baseUrl || stream.base_url,
    qualityId: Number(stream.id),
    codecId: Number(stream.codecid),
    codecs: stream.codecs || ""
  }));
  const audioData = (dash.audio || []).map(stream => ({
    label: ({ 30280: "192K", 30232: "132K", 30216: "64K" })[stream.id] || "标准音质",
    url: stream.baseUrl || stream.base_url,
    audioId: Number(stream.id)
  }));

  const dolbyAudio = Array.isArray(dash.dolby?.audio)
    ? dash.dolby.audio
    : dash.dolby?.audio ? [dash.dolby.audio] : [];
  dolbyAudio.forEach(stream => {
    const url = stream.baseUrl || stream.base_url;
    if (url) {
      audioData.push({
        label: "杜比全景声",
        url,
        audioId: 30250,
        format: "dolby",
        codecs: stream.codecs || ""
      });
    }
  });

  const losslessAudio = dash.flac?.audio;
  if (losslessAudio?.baseUrl || losslessAudio?.base_url) {
    audioData.push({
      label: "Hi-Res 无损",
      url: losslessAudio.baseUrl || losslessAudio.base_url,
      audioId: 30251,
      format: "flac"
    });
  }

  return {
    VideoData: videoData,
    AudioData: audioData,
    AcceptQuality: Array.isArray(data.accept_quality) ? data.accept_quality.map(Number) : [],
    SupportFormats: Array.isArray(data.support_formats)
      ? data.support_formats.map(format => ({
        qualityId: Number(format.quality),
        description: format.new_description || format.display_desc || "",
        codecs: Array.isArray(format.codecs) ? [...format.codecs] : []
      }))
      : []
  };
}

export async function fetchVideoDownloadInfo(media) {
  const identity = media?.bvid ? { bvid: media.bvid } : { aid: media?.aid || media?.id };
  if (!identity.bvid && !identity.aid) {
    throw new Error("收藏视频缺少有效的视频编号");
  }

  const video = await fetchBilibiliData(
    "https://api.bilibili.com/x/web-interface/view",
    identity,
    `读取视频“${media.title || "未命名视频"}”`
  );
  const sourcePages = Array.isArray(video.pages) && video.pages.length
    ? video.pages
    : [{ cid: video.cid, page: 1, part: video.title, first_frame: video.pic }];
  const pages = [];

  for (const sourcePage of sourcePages) {
    const streams = await fetchDownloadStreams(video.aid, sourcePage.cid);
    pages.push({
      cid: sourcePage.cid,
      page: sourcePage.page,
      title: sourcePage.part || sourcePage.title || video.title,
      pic: sourcePage.first_frame || video.pic || media.cover,
      videoData: streams.VideoData,
      audioData: streams.AudioData,
      acceptQuality: streams.AcceptQuality,
      supportFormats: streams.SupportFormats
    });
  }

  return {
    avid: Number(video.aid),
    videoName: video.title || media.title || "未命名视频",
    isCompilations: pages.length > 1,
    pages
  };
}
