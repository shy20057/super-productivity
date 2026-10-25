import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { DialogSyncCfgComponent } from '../../imex/sync/dialog-sync-cfg/dialog-sync-cfg.component';
import { SyncConfigService } from '../../imex/sync/sync-config.service';
import { SyncWrapperService } from '../../imex/sync/sync-wrapper.service';
import { SyncProviderManager } from '../../op-log/sync-providers/provider-manager.service';
import { GlobalConfigService } from '../config/global-config.service';
import { SyncLocalStateService } from '../../op-log/sync/sync-local-state.service';
import { SnackService } from '../../core/snack/snack.service';
import { DEFAULT_GLOBAL_CONFIG } from '../config/default-global-config.const';
import { SyncProviderId } from '../../op-log/sync-providers/provider.const';
import { CloudAccountDialogData } from './cloud-account.model';

describe('Cloud account sync dialog handoff', () => {
  let canSave: jasmine.Spy<() => Promise<boolean>>;
  let updateSettings: jasmine.Spy;
  let sync: jasmine.Spy;
  let close: jasmine.Spy;

  beforeEach(() => {
    canSave = jasmine.createSpy('canSave').and.resolveTo(true);
    updateSettings = jasmine.createSpy('updateSettingsFromForm').and.resolveTo();
    sync = jasmine.createSpy('sync').and.resolveTo();
    close = jasmine.createSpy('close');
    const config = {
      ...DEFAULT_GLOBAL_CONFIG.sync,
      syncProvider: SyncProviderId.SuperSync,
      isEnabled: true,
      superSync: { accessToken: 'old-token', baseUrl: 'https://cloud.example.com' },
    };
    const data: CloudAccountDialogData = {
      cloudAccount: {
        email: 'reader@example.com',
        credentials: {
          accessToken: 'new-token',
          baseUrl: 'https://cloud.example.com',
          encryptKey: 'stale-handoff-key',
        },
        canSave,
      },
    };
    TestBed.configureTestingModule({
      imports: [DialogSyncCfgComponent, TranslateModule.forRoot()],
      providers: [
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MatDialog, useValue: { open: jasmine.createSpy('open') } },
        {
          provide: SyncConfigService,
          useValue: {
            syncSettingsForm$: of(config),
            updateSettingsFromForm: updateSettings,
          },
        },
        {
          provide: SyncWrapperService,
          useValue: {
            configuredAuthForSyncProviderIfNecessary: async () => undefined,
            sync,
            markPromptEncryptionAfterSetupSync: jasmine.createSpy('markPrompt'),
          },
        },
        {
          provide: SyncProviderManager,
          useValue: {
            getProviderById: async () => ({
              privateCfg: {
                load: async () => ({
                  accessToken: 'old-token',
                  encryptKey: 'current-key',
                  isEncryptionEnabled: true,
                }),
              },
            }),
          },
        },
        { provide: GlobalConfigService, useValue: { sync$: of(config) } },
        { provide: SnackService, useValue: {} },
        { provide: SyncLocalStateService, useValue: {} },
      ],
    });
  });

  it('confirms the account without rendering tokens or provider-switch inputs', () => {
    const fixture = TestBed.createComponent(DialogSyncCfgComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('reader@example.com');
    expect(element.textContent).not.toContain('new-token');
    expect(element.querySelector('input')).toBeNull();
  });

  it('uses existing save flow and authoritative encryption state', async () => {
    const fixture = TestBed.createComponent(DialogSyncCfgComponent);
    fixture.detectChanges();
    await fixture.componentInstance.save();
    expect(updateSettings).toHaveBeenCalledTimes(1);
    const saved = updateSettings.calls.mostRecent().args[0];
    expect(saved.syncProvider).toBe(SyncProviderId.SuperSync);
    expect(saved.superSync).toEqual({
      accessToken: 'new-token',
      baseUrl: 'https://cloud.example.com',
    });
    expect(saved.encryptKey).toBe('current-key');
    expect(saved.isEncryptionEnabled).toBeTrue();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('never saves or starts sync when identity changed before confirmation', async () => {
    canSave.and.resolveTo(false);
    const fixture = TestBed.createComponent(DialogSyncCfgComponent);
    await fixture.componentInstance.save();
    expect(updateSettings).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(fixture.componentInstance.cloudAccountBlocked()).toBeTrue();
  });

  it('rechecks identity after asynchronous setup before persisting credentials', async () => {
    canSave.and.returnValues(Promise.resolve(true), Promise.resolve(false));
    const fixture = TestBed.createComponent(DialogSyncCfgComponent);
    await fixture.componentInstance.save();
    expect(canSave).toHaveBeenCalledTimes(2);
    expect(updateSettings).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
  });
});
