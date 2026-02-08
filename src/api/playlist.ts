import { getApiClient } from './client.js';
import { getAuthManager } from '../auth/manager.js';
import type { Playlist, Track } from '../types/index.js';

interface QQPlaylistDetailResponse {
  code: number;
  req_0: {
    code: number;
    data: {
      dirinfo: {
        id: number;
        title: string;
        desc?: string;
        picurl?: string;
        songnum: number;
        creator?: {
          encrypt_uin: string;
          name: string;
        };
      };
      songlist: {
        mid: string;
        name: string;
        singer: { mid: string; name: string }[];
        album: { mid: string; name: string; pmid?: string };
        interval: number;
      }[];
    };
  };
}

interface QQUserPlaylistsResponse {
  code: number;
  req_0: {
    code: number;
    data: {
      total: number;
      v_playlist: {
        dirId: number;
        dirName: string;
        coverUrl?: string;
        songNum: number;
      }[];
    };
  };
}

function transformTrack(track: {
  mid: string;
  name: string;
  singer: { mid: string; name: string }[];
  album: { mid: string; name: string; pmid?: string };
  interval: number;
}): Track {
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

export async function getPlaylistDetail(id: string): Promise<Playlist> {
  const client = getApiClient();
  const authManager = getAuthManager();
  const cookies = authManager.getCookies();
  const euin = cookies?.euin || '';

  const response = await client.request<QQPlaylistDetailResponse>({
    req_0: {
      module: 'music.srfDissInfo.DissInfo',
      method: 'CgiGetDiss',
      param: {
        dirid: Number(id),
        enc_host_uin: euin,
        onlysonglist: 0,
        song_begin: 0,
        song_num: 100000,
      },
    },
  });

  const dir = response.req_0.data.dirinfo;
  return {
    id: String(dir.id),
    name: dir.title,
    description: dir.desc,
    coverUrl: dir.picurl,
    trackCount: dir.songnum,
    creator: dir.creator
      ? {
          id: dir.creator.encrypt_uin,
          name: dir.creator.name,
        }
      : undefined,
    tracks: response.req_0.data.songlist?.map(transformTrack),
  };
}

export async function getUserPlaylists(): Promise<Playlist[]> {
  const client = getApiClient();
  const authManager = getAuthManager();
  const cookies = authManager.getCookies();
  const uin = cookies?.wxuin || cookies?.uin || '0';

  const response = await client.request<QQUserPlaylistsResponse>({
    req_0: {
      module: 'music.musicasset.PlaylistBaseRead',
      method: 'GetPlaylistByUin',
      param: {
        uin,
      },
    },
  });

  return (response.req_0.data.v_playlist || []).map((p) => ({
    id: String(p.dirId),
    name: p.dirName,
    coverUrl: p.coverUrl,
    trackCount: p.songNum,
  }));
}
