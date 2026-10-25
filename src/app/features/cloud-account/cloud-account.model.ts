import type { SuperSyncPrivateCfg } from '@sp/sync-providers/super-sync';

/** In-memory handoff only. Credentials are persisted by the existing sync setup. */
export interface CloudAccountSyncHandoff {
  email: string;
  credentials: SuperSyncPrivateCfg;
  canSave: () => Promise<boolean>;
}

export interface CloudAccountDialogData {
  cloudAccount: CloudAccountSyncHandoff;
}
