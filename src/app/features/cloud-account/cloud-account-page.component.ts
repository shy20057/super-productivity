import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../t.const';
import { CloudAccountService } from './cloud-account.service';
import { CloudAccountDialogData } from './cloud-account.model';

@Component({
  selector: 'cloud-account-page',
  templateUrl: './cloud-account-page.component.html',
  styleUrl: './cloud-account-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CloudAccountService],
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    TranslatePipe,
  ],
})
export class CloudAccountPageComponent implements OnInit {
  readonly account = inject(CloudAccountService);
  private readonly _dialog = inject(MatDialog);
  readonly T = T;
  readonly isOpeningSync = signal(false);
  readonly email = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  });

  ngOnInit(): void {
    void this.account.initialize();
  }

  async sendLink(): Promise<void> {
    if (this.email.invalid) {
      this.email.markAsTouched();
      return;
    }
    await this.account.requestLink(this.email.value);
  }

  async configureSync(): Promise<void> {
    if (this.isOpeningSync()) {
      return;
    }
    this.isOpeningSync.set(true);
    try {
      const handoff = await this.account.prepareSync();
      if (!handoff) {
        return;
      }
      const { DialogSyncCfgComponent } =
        await import('../../imex/sync/dialog-sync-cfg/dialog-sync-cfg.component');
      this._dialog.open<unknown, CloudAccountDialogData>(DialogSyncCfgComponent, {
        data: { cloudAccount: handoff },
      });
    } finally {
      this.isOpeningSync.set(false);
    }
  }

  async manageSync(): Promise<void> {
    const { DialogSyncCfgComponent } =
      await import('../../imex/sync/dialog-sync-cfg/dialog-sync-cfg.component');
    this._dialog.open(DialogSyncCfgComponent);
  }
}
