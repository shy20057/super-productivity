import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router, UrlTree } from '@angular/router';
import { Observable, of, ReplaySubject } from 'rxjs';
import { CloudAccountService } from './cloud-account.service';
import { SyncProviderManager } from '../../op-log/sync-providers/provider-manager.service';
import { GlobalConfigService } from '../config/global-config.service';
import { SyncProviderId } from '../../op-log/sync-providers/provider.const';
import type { SuperSyncPrivateCfg } from '@sp/sync-providers/super-sync';
import { DataInitStateService } from '../../core/data-init/data-init-state.service';

describe('CloudAccountService', () => {
  const serverUrl = 'https://cloud.example.com';
  const jwt = (userId: number): string =>
    `header.${btoa(JSON.stringify({ userId, email: 'reader@example.com' }))}.signature`;
  let service: CloudAccountService;
  let http: HttpTestingController;
  let router: jasmine.SpyObj<Router>;
  let stored: SuperSyncPrivateCfg | null;
  let selectedProvider: SyncProviderId | null;
  let tree: UrlTree;
  let dataLoaded$: Observable<boolean>;

  beforeEach(() => {
    stored = null;
    selectedProvider = null;
    tree = { queryParams: {} } as UrlTree;
    dataLoaded$ = of(true);
    router = jasmine.createSpyObj<Router>('Router', ['parseUrl', 'navigateByUrl'], {
      url: '/account',
    });
    router.parseUrl.and.returnValue(tree);
    router.navigateByUrl.and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        CloudAccountService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
        {
          provide: DataInitStateService,
          useValue: {
            get isAllDataLoadedInitially$() {
              return dataLoaded$;
            },
          },
        },
        {
          provide: GlobalConfigService,
          useValue: {
            sync$: of({
              get syncProvider() {
                return selectedProvider;
              },
            }),
          },
        },
        {
          provide: SyncProviderManager,
          useValue: {
            getProviderById: async () => ({ privateCfg: { load: async () => stored } }),
          },
        },
      ],
    });
    service = TestBed.inject(CloudAccountService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('scrubs the callback immediately and waits for persisted account hydration before login', async () => {
    const hydration = new ReplaySubject<boolean>(1);
    dataLoaded$ = hydration;
    tree.queryParams = { loginToken: 'one-use-secret' };
    const initialized = service.initialize();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(tree.queryParams).toEqual({});
    expect(service.state()).toBe('loading');
    http.expectNone('assets/cloud-account.json');
    http.expectNone(`${serverUrl}/api/login/magic-link/verify`);

    // The startup default was unconfigured; persisted settings belong to a
    // different provider. They must be authoritative before any sync handoff.
    selectedProvider = SyncProviderId.WebDAV;
    hydration.next(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    http.expectOne('assets/cloud-account.json').flush({ serverUrl });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    http.expectOne(`${serverUrl}/api/login/magic-link/verify`).flush({
      token: jwt(1),
      user: { id: 1, email: 'reader@example.com' },
    });
    await initialized;
    expect(await service.prepareSync()).toBeNull();
    expect(service.state()).toBe('blocked');
  });

  const initialize = async (configuredUrl: string | null = serverUrl): Promise<void> => {
    const initialized = service.initialize();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    http.expectOne('assets/cloud-account.json').flush({ serverUrl: configuredUrl });
    await initialized;
  };

  it('stays unavailable when deployment has no cloud server', async () => {
    await initialize(null);
    expect(service.state()).toBe('unavailable');
    await service.requestLink('reader@example.com');
    http.expectNone(`${serverUrl}/api/login/magic-link`);
  });

  it('removes the one-use token from the URL before any HTTP request', async () => {
    tree.queryParams = { loginToken: 'one-use-secret', keep: 'yes' };
    let finishNavigation!: (value: boolean) => void;
    router.navigateByUrl.and.returnValue(
      new Promise((resolve) => {
        finishNavigation = resolve;
      }),
    );
    const initialized = service.initialize();
    expect(tree.queryParams).toEqual({ keep: 'yes' });
    expect(router.navigateByUrl).toHaveBeenCalledWith(tree, { replaceUrl: true });
    http.expectNone('assets/cloud-account.json');
    finishNavigation(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    http.expectOne('assets/cloud-account.json').flush({ serverUrl });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const verify = http.expectOne(`${serverUrl}/api/login/magic-link/verify`);
    expect(verify.request.body).toEqual({ token: 'one-use-secret' });
    verify.flush({ token: jwt(1), user: { id: 1, email: 'reader@example.com' } });
    await initialized;
    expect(service.state()).toBe('authenticated');
  });

  it('sends email links without credentials or passwords', async () => {
    await initialize();
    const requested = service.requestLink(' reader@example.com ');
    const request = http.expectOne(`${serverUrl}/api/login/magic-link`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'reader@example.com' });
    request.flush({ message: 'sent' });
    await requested;
    expect(service.state()).toBe('sent');
  });

  it('does not surface backend error details or retain failed credentials', async () => {
    await initialize();
    const requested = service.requestLink('reader@example.com');
    http
      .expectOne(`${serverUrl}/api/login/magic-link`)
      .flush({ error: 'secret internals' }, { status: 500, statusText: 'Error' });
    await requested;
    expect(service.state()).toBe('error');
    expect(await service.prepareSync()).toBeNull();
  });

  const authenticate = async (): Promise<void> => {
    tree.queryParams = { loginToken: 'one-use-secret' };
    const initialized = service.initialize();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    http.expectOne('assets/cloud-account.json').flush({ serverUrl });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    http
      .expectOne(`${serverUrl}/api/login/magic-link/verify`)
      .flush({ token: jwt(1), user: { id: 1, email: 'reader@example.com' } });
    await initialized;
  };

  it('hands off fresh credentials while retaining this account encryption key', async () => {
    selectedProvider = SyncProviderId.SuperSync;
    stored = {
      baseUrl: serverUrl,
      accessToken: jwt(1),
      encryptKey: 'existing-key',
      isEncryptionEnabled: true,
    };
    await authenticate();
    const handoff = await service.prepareSync();
    expect(handoff?.credentials.encryptKey).toBe('existing-key');
    expect(handoff?.credentials.isEncryptionEnabled).toBeTrue();
    expect(handoff?.credentials.accessToken).toBe(jwt(1));
    expect(await handoff?.canSave()).toBeTrue();
    expect(stored.encryptKey).toBe('existing-key');
  });

  it('blocks another account and rechecks identity before saving a handoff', async () => {
    await authenticate();
    const handoff = await service.prepareSync();
    stored = { baseUrl: serverUrl, accessToken: jwt(2) };
    expect(await handoff?.canSave()).toBeFalse();
    expect(service.state()).toBe('blocked');
    expect(await service.prepareSync()).toBeNull();
  });

  it('blocks another server even when numeric account ids match', async () => {
    stored = { baseUrl: 'https://other.example.com', accessToken: jwt(1) };
    await authenticate();
    expect(await service.prepareSync()).toBeNull();
    expect(service.state()).toBe('blocked');
  });

  it('blocks an existing account whose identity cannot be established', async () => {
    stored = { baseUrl: serverUrl, accessToken: '', encryptKey: 'existing-key' };
    await authenticate();
    expect(await service.prepareSync()).toBeNull();
  });

  it('blocks replacing another configured sync provider', async () => {
    selectedProvider = SyncProviderId.WebDAV;
    await authenticate();
    expect(await service.prepareSync()).toBeNull();
    expect(service.state()).toBe('blocked');
  });

  it('blocks a selected SuperSync account even when its credentials were cleared', async () => {
    selectedProvider = SyncProviderId.SuperSync;
    await authenticate();
    expect(await service.prepareSync()).toBeNull();
    expect(service.state()).toBe('blocked');
  });

  it('scrubs callback credentials even when cloud login is unavailable', async () => {
    tree.queryParams = { loginToken: 'one-use-secret' };
    await initialize(null);
    expect(tree.queryParams).toEqual({});
    expect(service.state()).toBe('unavailable');
    http.expectNone(`${serverUrl}/api/login/magic-link/verify`);
  });

  it('rejects an expired email link without retaining a sync handoff', async () => {
    tree.queryParams = { loginToken: 'expired-link' };
    const initialized = service.initialize();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    http.expectOne('assets/cloud-account.json').flush({ serverUrl });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    http
      .expectOne(`${serverUrl}/api/login/magic-link/verify`)
      .flush({ error: 'private details' }, { status: 401, statusText: 'Unauthorized' });
    await initialized;
    expect(service.state()).toBe('error');
    expect(await service.prepareSync()).toBeNull();
    expect(tree.queryParams).toEqual({});
  });
});
