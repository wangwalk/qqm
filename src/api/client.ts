import axios, { AxiosInstance, AxiosError } from 'axios';
import { createHash } from 'crypto';
import { getAuthManager } from '../auth/manager.js';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { pipeline } from 'stream/promises';
import type { Readable } from 'stream';
import { verbose, debug } from '../output/logger.js';

// Force IPv4 to avoid IPv6 CDN hotlink protection issues
const httpAgent = new http.Agent({ family: 4 });
const httpsAgent = new https.Agent({ family: 4 });

const BASE_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface QQMusicModule {
  module: string;
  method: string;
  param: Record<string, unknown>;
}

export class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: requestTimeout,
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
        Origin: 'https://y.qq.com',
        Referer: 'https://c.y.qq.com/',
      },
      httpAgent,
      httpsAgent,
    });
  }

  updateTimeout(ms: number): void {
    this.client.defaults.timeout = ms;
  }

  private computeGtk(): number {
    const authManager = getAuthManager();
    const cookies = authManager.getCookies();
    const key = cookies?.qm_keyst || '';
    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
      hash += (hash << 5) + key.charCodeAt(i);
    }
    return hash & 0x7fffffff;
  }

  private getUin(): string {
    const authManager = getAuthManager();
    const cookies = authManager.getCookies();
    return cookies?.wxuin || cookies?.uin || '0';
  }

  private computeSign(body: Record<string, unknown>): string {
    const P1 = [23, 14, 6, 36, 16, 7, 19]; // filtered from [23,14,6,36,16,40,7,19] where < 40
    const P2 = [16, 1, 32, 12, 19, 27, 8, 5];
    const SV = [89, 39, 179, 150, 218, 82, 58, 252, 177, 52, 186, 123, 120, 64, 242, 133, 143, 161, 121, 179];
    const h = createHash('sha1').update(JSON.stringify(body)).digest('hex').toUpperCase();
    const p1 = P1.map((i) => h[i]).join('');
    const p2 = P2.map((i) => h[i]).join('');
    const buf = Buffer.alloc(20);
    for (let i = 0; i < 20; i++) buf[i] = SV[i] ^ parseInt(h.slice(i * 2, i * 2 + 2), 16);
    return ('zzc' + p1 + buf.toString('base64').replace(/[/+=]/g, '') + p2).toLowerCase();
  }

  async request<T>(modules: Record<string, QQMusicModule>): Promise<T> {
    const gtk = this.computeGtk();
    const uin = this.getUin();
    const authManager = getAuthManager();
    const cookies = authManager.getCookies();

    const body: Record<string, unknown> = {
      comm: {
        cv: 4747474,
        ct: 11,
        format: 'json',
        inCharset: 'utf-8',
        outCharset: 'utf-8',
        notice: 0,
        platform: 'yqq.json',
        needNewCode: 0,
        uin,
        qq: uin,
        authst: cookies?.qm_keyst || '',
        tmeLoginType: String(cookies?.tmeLoginType || '1'),
        tmeAppID: 'qqmusic',
        g_tk_new_20200303: gtk,
        g_tk: gtk,
      },
      ...modules,
    };

    const sign = this.computeSign(body);
    const moduleNames = Object.keys(modules).join(', ');
    verbose(`QQ Music API: ${moduleNames}`);
    debug(`POST ${BASE_URL} (sign=${sign})`);

    const cookieString = authManager.getCookieString();

    try {
      const response = await this.client.post<T>(`${BASE_URL}?sign=${sign}`, body, {
        headers: cookieString ? { Cookie: cookieString } : {},
      });

      const responseData = response.data as { code?: number; message?: string };
      debug(`Response code: ${responseData.code ?? 0}`);
      if (responseData.code && responseData.code !== 0) {
        const msg = responseData.message || 'Unknown error';
        throw new Error(`${msg} (code: ${responseData.code})`);
      }

      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        debug(`HTTP error: ${error.response?.status ?? error.code}`);
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          throw new Error('Network connection failed');
        }
        if (error.response?.status === 401) {
          throw new Error('Authentication failed, please re-login');
        }
        if (error.response?.status === 403) {
          throw new Error('Access denied, login required or cookie expired');
        }
        throw new Error(`Request failed: ${error.message}`);
      }
      throw error;
    }
  }

  async download(url: string, destPath: string): Promise<void> {
    verbose(`Downloading ${url}`);
    const response = await axios.get<Readable>(url, {
      responseType: 'stream',
      timeout: 120000,
      httpAgent,
      httpsAgent,
      headers: {
        'User-Agent': USER_AGENT,
        Referer: 'https://y.qq.com/',
      },
    });
    await pipeline(response.data, fs.createWriteStream(destPath));
  }
}

let requestTimeout = 30000;

export function setRequestTimeout(ms: number): void {
  requestTimeout = ms;
  if (clientInstance) {
    clientInstance.updateTimeout(ms);
  }
}

let clientInstance: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (!clientInstance) {
    clientInstance = new ApiClient();
  }
  return clientInstance;
}
