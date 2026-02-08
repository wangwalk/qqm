import { getApiClient } from './client.js';
import type { Track, UserProfile } from '../types/index.js';

interface QQUserInfoResponse {
  code: number;
  req_0: {
    code: number;
    data: {
      creator: {
        encrypt_uin: string;
        nick: string;
        headpic?: string;
      };
    };
  };
}

interface QQFavSongListResponse {
  code: number;
  req_0: {
    code: number;
    data: {
      songlist: {
        mid: string;
        name: string;
        singer: { mid: string; name: string }[];
        album: { mid: string; name: string; pmid?: string };
        interval: number;
      }[];
      totalnum: number;
    };
  };
}

interface QQRecentResponse {
  code: number;
  req_0: {
    code: number;
    data: {
      vecPlayRecord: {
        unPlayTime: number;
        stSongInfo: {
          mid: string;
          name: string;
          singer: { mid: string; name: string }[];
          album: { mid: string; name: string; pmid?: string };
          interval: number;
        };
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

export async function getUserProfile(): Promise<UserProfile> {
  const client = getApiClient();
  const response = await client.request<QQUserInfoResponse>({
    req_0: {
      module: 'music.UnLoginModule.MyHomepage',
      method: 'MyHomepage',
      param: {},
    },
  });

  const creator = response.req_0.data.creator;
  return {
    id: creator.encrypt_uin,
    nickname: creator.nick,
    avatarUrl: creator.headpic,
  };
}

export async function getLikedTrackIds(): Promise<string[]> {
  const client = getApiClient();
  const response = await client.request<QQFavSongListResponse>({
    req_0: {
      module: 'music.srfDissInfo.aiDissInfo',
      method: 'uniform_get_Ede_Diss_info',
      param: {
        onlysonglist: 1,
        disstid: 0,
        song_begin: 0,
        song_num: 1000,
      },
    },
  });
  return response.req_0.data.songlist.map((s) => s.mid);
}

export async function likeTrack(mid: string, like: boolean = true): Promise<void> {
  const client = getApiClient();
  if (like) {
    await client.request({
      req_0: {
        module: 'music.musicasset.SongFavRead',
        method: 'AddSongFav',
        param: {
          songmid: [mid],
        },
      },
    });
  } else {
    await client.request({
      req_0: {
        module: 'music.musicasset.SongFavRead',
        method: 'RemoveSongFav',
        param: {
          songmid: [mid],
        },
      },
    });
  }
}

export async function getRecentTracks(limit: number = 100): Promise<Track[]> {
  const client = getApiClient();
  const response = await client.request<QQRecentResponse>({
    req_0: {
      module: 'music.musichallSong.RecentPlayList',
      method: 'GetRecentPlayList',
      param: {
        begin: 0,
        num: limit,
      },
    },
  });
  return (response.req_0.data.vecPlayRecord || []).map((item) =>
    transformTrack(item.stSongInfo),
  );
}
