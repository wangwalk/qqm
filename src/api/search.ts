import { getApiClient } from './client.js';
import type { SearchType, SearchResult, Track, Album, Playlist, Artist } from '../types/index.js';

interface QQSearchResponse {
  code: number;
  req_0: {
    code: number;
    data: {
      body: {
        song?: {
          list: QQTrack[];
        };
        album?: {
          list: QQAlbum[];
        };
        songlist?: {
          list: QQPlaylist[];
        };
        singer?: {
          list: QQArtist[];
        };
      };
      meta?: {
        sum: number;
        estimate_sum: number;
      };
    };
  };
}

interface QQTrack {
  mid: string;
  name: string;
  singer: { mid: string; name: string }[];
  album: { mid: string; name: string; pmid?: string };
  interval: number;
}

interface QQAlbum {
  albumMID: string;
  albumName: string;
  albumPic?: string;
}

interface QQPlaylist {
  dissid: string;
  dissname: string;
  introduction?: string;
  imgurl?: string;
  song_count: number;
  creator?: { encrypt_uin: string; name: string };
}

interface QQArtist {
  singerMID: string;
  singerName: string;
}

const typeMap: Record<SearchType, number> = {
  track: 0,
  album: 2,
  playlist: 3,
  artist: 1,
};

function transformTrack(track: QQTrack): Track {
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

function transformAlbum(album: QQAlbum): Album {
  return {
    id: album.albumMID,
    name: album.albumName,
    picUrl: album.albumPic,
  };
}

function transformPlaylist(playlist: QQPlaylist): Playlist {
  return {
    id: playlist.dissid,
    name: playlist.dissname,
    description: playlist.introduction,
    coverUrl: playlist.imgurl,
    trackCount: playlist.song_count,
    creator: playlist.creator
      ? {
          id: playlist.creator.encrypt_uin,
          name: playlist.creator.name,
        }
      : undefined,
  };
}

function transformArtist(artist: QQArtist): Artist {
  return {
    id: artist.singerMID,
    name: artist.singerName,
  };
}

export async function search(
  keyword: string,
  type: SearchType = 'track',
  limit: number = 20,
  offset: number = 0,
): Promise<SearchResult> {
  const client = getApiClient();

  const response = await client.request<QQSearchResponse>({
    req_0: {
      module: 'music.search.SearchCgiService',
      method: 'DoSearchForQQMusicDesktop',
      param: {
        query: keyword,
        page_num: Math.floor(offset / limit) + 1,
        num_per_page: limit,
        search_type: typeMap[type],
      },
    },
  });

  const data = response.req_0.data;
  const body = data.body;
  const estimateTotal = data.meta?.estimate_sum || data.meta?.sum || 0;
  const result: SearchResult = {
    total: estimateTotal,
    offset,
    limit,
  };

  switch (type) {
    case 'track':
      result.tracks = (body.song?.list || []).map(transformTrack);
      break;
    case 'album':
      result.albums = (body.album?.list || []).map(transformAlbum);
      break;
    case 'playlist':
      result.playlists = (body.songlist?.list || []).map(transformPlaylist);
      break;
    case 'artist':
      result.artists = (body.singer?.list || []).map(transformArtist);
      break;
  }

  return result;
}
