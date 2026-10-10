export const QUALITY_OPTIONS = [
  { qualityId: 6, label: "240P" },
  { qualityId: 16, label: "360P" },
  { qualityId: 32, label: "480P" },
  { qualityId: 64, label: "720P" },
  { qualityId: 74, label: "720P60", requiresLogin: true },
  { qualityId: 80, label: "1080P", requiresLogin: true },
  { qualityId: 100, label: "智能修复", requiresVip: true },
  { qualityId: 112, label: "1080P+", requiresVip: true },
  { qualityId: 116, label: "1080P60", requiresVip: true },
  { qualityId: 120, label: "4K", requiresVip: true },
  { qualityId: 125, label: "HDR", requiresVip: true },
  { qualityId: 126, label: "杜比视界", requiresVip: true },
  { qualityId: 127, label: "8K", requiresVip: true },
  { qualityId: 129, label: "HDR Vivid", requiresVip: true, unsupported: true }
];

export const AUDIO_OPTIONS = [
  { audioId: 30216, label: "64K" },
  { audioId: 30232, label: "132K" },
  { audioId: 30280, label: "192K" },
  { audioId: 30250, label: "杜比全景声", requiresVip: true, format: "dolby" },
  { audioId: 30251, label: "Hi-Res 无损", requiresVip: true, format: "flac" }
];

export const DEFAULT_DOWNLOAD_CONFIG = Object.freeze({
  quality: "auto",
  codec: "auto",
  audio: "auto"
});

const STORAGE_KEY = "bili-downloader:download-config";
const QUALITY_VALUES = new Set(["auto", ...QUALITY_OPTIONS.map(option => String(option.qualityId))]);
const CODEC_VALUES = new Set(["auto", "7", "12", "13"]);
const AUDIO_VALUES = new Set(["auto", ...AUDIO_OPTIONS.map(option => String(option.audioId))]);
const AUDIO_RANKS = { 30216: 64, 30232: 132, 30280: 192, 30250: 320, 30251: Number.POSITIVE_INFINITY };

export function loadDownloadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      quality: QUALITY_VALUES.has(String(saved.quality)) ? String(saved.quality) : DEFAULT_DOWNLOAD_CONFIG.quality,
      codec: CODEC_VALUES.has(String(saved.codec)) ? String(saved.codec) : DEFAULT_DOWNLOAD_CONFIG.codec,
      audio: AUDIO_VALUES.has(String(saved.audio)) ? String(saved.audio) : DEFAULT_DOWNLOAD_CONFIG.audio
    };
  } catch {
    return { ...DEFAULT_DOWNLOAD_CONFIG };
  }
}

export function saveDownloadConfig(config) {
  const normalized = {
    quality: QUALITY_VALUES.has(String(config.quality)) ? String(config.quality) : DEFAULT_DOWNLOAD_CONFIG.quality,
    codec: CODEC_VALUES.has(String(config.codec)) ? String(config.codec) : DEFAULT_DOWNLOAD_CONFIG.codec,
    audio: AUDIO_VALUES.has(String(config.audio)) ? String(config.audio) : DEFAULT_DOWNLOAD_CONFIG.audio
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function selectDefaultVideo(options, config) {
  if (!Array.isArray(options) || options.length === 0) return undefined;

  const availableQualities = options
    .map(option => Number(option.qualityId))
    .filter(Number.isFinite);

  if (availableQualities.length === 0) return options[0];

  const preferredQuality = config.quality === "auto"
    ? Math.max(...availableQualities)
    : Number(config.quality);
  const qualitiesAtOrBelow = availableQualities.filter(quality => quality <= preferredQuality);
  const selectedQuality = qualitiesAtOrBelow.length > 0
    ? Math.max(...qualitiesAtOrBelow)
    : Math.min(...availableQualities);

  let candidates = options.filter(option => Number(option.qualityId) === selectedQuality);
  if (config.codec !== "auto") {
    const preferredCodec = candidates.filter(option => Number(option.codecId) === Number(config.codec));
    if (preferredCodec.length > 0) candidates = preferredCodec;
  }

  return candidates[0] || options[0];
}

export function selectDefaultAudio(options, config) {
  if (!Array.isArray(options) || options.length === 0) return undefined;

  const rank = option => AUDIO_RANKS[option.audioId] || 0;
  if (config.audio === "auto") {
    return options.reduce((best, option) => rank(option) > rank(best) ? option : best, options[0]);
  }

  const exactMatch = options.find(option => String(option.audioId) === config.audio);
  if (exactMatch) return exactMatch;

  const preferredRank = AUDIO_RANKS[config.audio] || 0;
  const rankedOptions = options.map(option => ({ option, rank: rank(option) }));
  const lowerOrEqual = rankedOptions.filter(item => item.rank > 0 && item.rank <= preferredRank);
  if (lowerOrEqual.length > 0) {
    return lowerOrEqual.reduce((best, item) => item.rank > best.rank ? item : best).option;
  }

  return rankedOptions
    .filter(item => item.rank > 0)
    .reduce((best, item) => !best || item.rank < best.rank ? item : best, null)?.option || options[0];
}
