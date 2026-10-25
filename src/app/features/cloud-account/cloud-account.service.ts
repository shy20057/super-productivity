import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  SUPER_SYNC_DEFAULT_BASE_URL,
  type SuperSyncPrivateCfg,
} from '@sp/sync-providers/super-sync';
import { GlobalConfigService } from '../config/global-config.service';
import { SyncProviderManager } from '../../op-log/sync-providers/provider-manager.service';
import { SyncProviderId } from '../../op-log/sync-providers/provider.const';
import { CloudAccountSyncHandoff } from './cloud-account.model';
import { DataInitStateService } from '../../core/data-init/data-init-state.service';

type AccountState =
  | 'loading'
  | 'unavailable'
  | 'ready'
  | 'sending'
  | 'sent'
  | 'verifying'
  | 'authenticated'
  | 'blocked'
  | 'error';

interface LoginResult {
  token: string;
  user: { id: number; email: string };
}

/** Decode identity only for local account comparison; the server authenticates JWTs. */
const readTokenIdentity = (token: string): { userId: number; email: string } | null => {
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(normalized), (character) =>
      character.charCodeAt(0),
    );
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (
      typeof value === 'object' &&
      value !== null &&
      'userId' in value &&
      typeof value.userId === 'number' &&
      Number.isSafeInteger(value.userId) &&
      'email' in value &&
      typeof value.email === 'string'
    ) {
      return { userId: value.userId, email: value.email };
    }
  } catch {
    // Old, expired or malformed credentials must never authorize an account switch.
  }
  return null;
};

const normalizeServerUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  try {
    const url = new URL(value);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (
      (url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:')) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
};

@Injectable()
export class CloudAccountService {
  private readonly _http = inject(HttpClient);
  private readonly _router = inject(Router);
  private readonly _providerManager = inject(SyncProviderManager);
  private readonly _globalConfig = inject(GlobalConfigService);
  private readonly _dataInitState = inject(DataInitStateService);
  private _login: LoginResult | null = null;

  readonly state = signal<AccountState>('loading');
  readonly serverUrl = signal<string | null>(null);
  readonly accountEmail = signal<string | null>(null);
  readonly isSyncConfigured = signal(false);

  async initialize(): Promise<void> {
    // Scrub first, even if deployment config is absent or loading fails. Do not
    // retain a one-use email credential in history while making ANY HTTP call.
    const tree = this._router.parseUrl(this._router.url);
    const callbackToken: unknown = tree.queryParams['loginToken'];
    if ('loginToken' in tree.queryParams) {
      delete tree.queryParams['loginToken'];
      try {
        if (!(await this._router.navigateByUrl(tree, { replaceUrl: true }))) {
          this.state.set('error');
          return;
        }
      } catch {
        this.state.set('error');
        return;
      }
    }

    try {
      // A direct email callback can render before persisted settings load.
      // Account admission must use the hydrated provider and credentials.
      await firstValueFrom(this._dataInitState.isAllDataLoadedInitially$);
      const config = await firstValueFrom(
        this._http.get<{ serverUrl?: unknown }>('assets/cloud-account.json'),
      );
      this.serverUrl.set(normalizeServerUrl(config?.serverUrl));
      const globalConfig = await firstValueFrom(this._globalConfig.sync$);
      this.isSyncConfigured.set(!!globalConfig.syncProvider);
      const provider = await this._providerManager.getProviderById(
        SyncProviderId.SuperSync,
      );
      const stored = (await provider?.privateCfg.load()) as SuperSyncPrivateCfg | null;
      this.accountEmail.set(readTokenIdentity(stored?.accessToken ?? '')?.email ?? null);
    } catch {
      this.state.set('unavailable');
      return;
    }

    if (!this.serverUrl()) {
      this.state.set('unavailable');
      return;
    }
    if (typeof callbackToken === 'string' && callbackToken) {
      await this._verify(callbackToken);
    } else {
      this.state.set('ready');
    }
  }

  async requestLink(email: string): Promise<void> {
    const serverUrl = this.serverUrl();
    if (!serverUrl || this.state() === 'sending') {
      return;
    }
    this._login = null;
    this.state.set('sending');
    try {
      await firstValueFrom(
        this._http.post(`${serverUrl}/api/login/magic-link`, { email: email.trim() }),
      );
      this.state.set('sent');
    } catch {
      this.state.set('error');
    }
  }

  async prepareSync(): Promise<CloudAccountSyncHandoff | null> {
    const login = this._login;
    const serverUrl = this.serverUrl();
    if (!login || !serverUrl) {
      return null;
    }
    const stored = await this._checkIdentity(login, serverUrl);
    if (stored === false) {
      return null;
    }
    return {
      email: login.user.email,
      credentials: { ...stored, baseUrl: serverUrl, accessToken: login.token },
      canSave: async () => (await this._checkIdentity(login, serverUrl)) !== false,
    };
  }

  private async _verify(token: string): Promise<void> {
    this.state.set('verifying');
    try {
      const result = await firstValueFrom(
        this._http.post<LoginResult>(`${this.serverUrl()}/api/login/magic-link/verify`, {
          token,
        }),
      );
      const identity = readTokenIdentity(result?.token);
      if (
        !identity ||
        identity.userId !== result.user?.id ||
        identity.email !== result.user?.email
      ) {
        this.state.set('error');
        return;
      }
      this._login = result;
      this.state.set('authenticated');
    } catch {
      this._login = null;
      this.state.set('error');
    }
  }

  private async _checkIdentity(
    login: LoginResult,
    serverUrl: string,
  ): Promise<SuperSyncPrivateCfg | null | false> {
    try {
      await firstValueFrom(this._dataInitState.isAllDataLoadedInitially$);
      const globalConfig = await firstValueFrom(this._globalConfig.sync$);
      const provider = await this._providerManager.getProviderById(
        SyncProviderId.SuperSync,
      );
      const stored = (await provider?.privateCfg.load()) as SuperSyncPrivateCfg | null;
      const hasStoredAccount = !!(
        stored?.accessToken ||
        stored?.refreshToken ||
        stored?.encryptKey ||
        stored?.isEncryptionEnabled
      );
      const identity = readTokenIdentity(stored?.accessToken ?? '');
      if (
        !provider ||
        (globalConfig.syncProvider &&
          globalConfig.syncProvider !== SyncProviderId.SuperSync) ||
        (globalConfig.syncProvider === SyncProviderId.SuperSync && !identity) ||
        (hasStoredAccount &&
          (!identity ||
            identity.userId !== login.user.id ||
            normalizeServerUrl(stored?.baseUrl || SUPER_SYNC_DEFAULT_BASE_URL) !==
              serverUrl))
      ) {
        this.state.set('blocked');
        return false;
      }
      return stored;
    } catch {
      this.state.set('blocked');
      return false;
    }
  }
}
