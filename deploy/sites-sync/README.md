# Super Productivity static Site

This directory prepares the existing Angular frontend for static Sites hosting.
It provides no custom account page, ChatGPT login or Sites synchronization API.
Use the original controls in Settings → Sync & Backup → Sync to select Dropbox,
SuperSync or another existing provider and complete that provider's login.

## Prepare a local artifact

Build Angular with its productionWeb configuration. From the application root:

```text
node deploy/sites-sync/scripts/prepare-static.mjs <browser-build-dir> [previous-static-assets-dir]
```

The output is dist/, declared by .openai/hosting.json. No Node dependencies or
server build are required for this deployment wrapper. Existing immutable lazy
chunks can be retained from a separate previous assets directory for open tabs.
In the dedicated Sites source checkout, include dist/ as tracked static source:
remove the local /dist/ ignore rule from that checkout before the source helper
commits it. The main application checkout keeps generated artifacts ignored.

Preserve the existing Site project ID and audience. The BUCKET binding is
retained solely to avoid removing previously provisioned storage. No shipped
application code uses it. Existing R2 files and device-local IndexedDB data,
provider credentials, encryption passwords and preview storage are not deleted.
The ignored runtime/dependency directories may contain prior local preview data;
they are not part of the static artifact or source package.

The first static publication retires the old /api/sites/account and
/api/sites/dav/* endpoints. It does not migrate data into another provider.
Complete any needed export/sync using the existing public version before a later
publication if that version contains data you need.

## Publication gate

Before every Sites source push or deployment, first ask whether all local
modifications are complete and wait for the user's explicit confirmation.
Preparing dist/ is local only. Publish the reviewed artifact through the Sites
source/save/deploy workflow only after that confirmation.
