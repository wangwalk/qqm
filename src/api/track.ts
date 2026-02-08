import * as os from 'os';
import * as path from 'path';
import { getApiClient } from './client.js';
import type { Track, Lyric, Quality } from '../types/index.js';

interface QQTrackDetailResponse {
  code: number;
  req_0: {
    code: number;
    data: {
      track_info: {
        mid: string;
        name: string;
        singer: { mid: string; name: string }[];
        album: { mid: string; name: string; pmid?: string };
        interval: number;
      };
    };
  };
}

interface QQVkeyResponse {
  code: number;
  req_0: {
    code: number;
    data: {
      midurlinfo: {
        songmid: string;
        purl: string;
      }[];
      sip: string[];
    };
  };
}

interface QQLyricResponse {
  code: number;
  req_0: {
    code: number;
    data: {
      lyric: string;
      trans: string;
    };
  };
}

// Quality → file prefix mapping
// M500 = 128kbps MP3, M800 = 320kbps MP3, F000 = FLAC, RS01 = HiRes FLAC
const qualityFileMap: Record<Quality, { prefix: string; ext: string }> = {
  standard: { prefix: 'M500', ext: '.mp3' },
  high: { prefix: 'M800', ext: '.mp3' },
  sq: { prefix: 'F000', ext: '.flac' },
  flac: { prefix: 'F000', ext: '.flac' },
  hires: { prefix: 'RS01', ext: '.flac' },
};

export async function getTrackDetail(mid: string): Promise<Track> {
  const client = getApiClient();

  const response = await client.request<QQTrackDetailResponse>({
    req_0: {
      module: 'music.pf_song_detail_svr',
      method: 'get_song_detail_yqq',
      param: {
        song_mid: mid,
        song_type: 0,
      },
    },
  });

  const track = response.req_0.data.track_info;
  const albumPicUrl = track.album.pmid
    ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${track.album.pmid}.jpg`
    : undefined;

  return {
    id: track.mid,
    name: track.name,
    artists: track.singer.map((s) => ({ id: s.mid, name: s.name })),
    album: {
      id: track.album.mid,
      name: track.album.name,
      picUrl: albumPicUrl,
    },
    duration: track.interval * 1000,
    uri: `qqmusic:track:${track.mid}`,
  };
}

export async function getTrackUrl(mid: string, quality: Quality = 'high'): Promise<string> {
  const client = getApiClient();
  const { prefix, ext } = qualityFileMap[quality];
  const filename = `${prefix}${mid}${mid}${ext}`;

  const response = await client.request<QQVkeyResponse>({
    req_0: {
      module: 'music.vkey.GetVkey',
      method: 'UrlGetVkey',
      param: {
        songmid: [mid],
        songtype: [0],
        filename: [filename],
        guid: String(Math.floor(Math.random() * 10000000000)),
        platform: '20',
      },
    },
  });

  const data = response.req_0.data;
  const purl = data.midurlinfo?.[0]?.purl;
  if (!purl) {
    throw new Error('Track unavailable (no copyright or VIP required)');
  }

  const sip = data.sip?.[0] || 'https://dl.stream.qqmusic.qq.com/';
  return `${sip}${purl}`;
}

export async function getLyric(mid: string): Promise<Lyric> {
  const client = getApiClient();

  const response = await client.request<QQLyricResponse>({
    req_0: {
      module: 'music.musichallSong.PlayLyricInfo',
      method: 'GetPlayLyricInfo',
      param: {
        songMID: mid,
        songID: 0,
      },
    },
  });

  const data = response.req_0.data;
  const lrc = data.lyric ? Buffer.from(data.lyric, 'base64').toString('utf-8') : undefined;
  const tlyric = data.trans ? Buffer.from(data.trans, 'base64').toString('utf-8') : undefined;

  return { lrc, tlyric };
}

export async function downloadTrack(
  mid: string,
  quality: Quality = 'high',
  outputPath?: string,
): Promise<{ path: string; size: number }> {
  const client = getApiClient();
  const url = await getTrackUrl(mid, quality);

  const ext = url.includes('.flac') ? 'flac' : 'mp3';
  const dest = outputPath || path.join(os.tmpdir(), `qqm-${mid}.${ext}`);

  await client.download(url, dest);

  const { size } = await import('fs').then((fs) => fs.statSync(dest));
  return { path: dest, size };
}

export async function getTrackDetails(mids: string[]): Promise<Track[]> {
  const client = getApiClient();

  // QQ Music doesn't have a batch detail API, so we fetch individually
  // For efficiency, we use Promise.all with a concurrency limit
  const results: Track[] = [];
  const batchSize = 10;
  for (let i = 0; i < mids.length; i += batchSize) {
    const batch = mids.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (mid) => {
        try {
          const response = await client.request<QQTrackDetailResponse>({
            req_0: {
              module: 'music.pf_song_detail_svr',
              method: 'get_song_detail_yqq',
              param: { song_mid: mid, song_type: 0 },
            },
          });
          const track = response.req_0.data.track_info;
          const albumPicUrl = track.album.pmid
            ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${track.album.pmid}.jpg`
            : undefined;
          return {
            id: track.mid,
            name: track.name,
            artists: track.singer.map((s) => ({ id: s.mid, name: s.name })),
            album: {
              id: track.album.mid,
              name: track.album.name,
              picUrl: albumPicUrl,
            },
            duration: track.interval * 1000,
            uri: `qqmusic:track:${track.mid}`,
          };
        } catch {
          return null;
        }
      }),
    );
    results.push(...(batchResults.filter(Boolean) as Track[]));
  }
  return results;
}
