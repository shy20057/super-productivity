# Personal cloud sync deployment

This is deployment preparation, not a running cloud database. It reuses the
existing SuperSync server, its account isolation and encrypted sync protocol.
The static web app stays on Sites; Render runs the authenticated API; Supabase
hosts PostgreSQL. Supabase Auth is not used by this configuration.

## Prerequisites

- An authorized Supabase project and Render workspace. Create resources only
  after reviewing their current plans and limits. This template selects a free
  Render service and does not authorize paid resources.
- A Brevo API key with transactional-email sending permission and a verified
  sender. This template sends through HTTPS, so Render's free-service SMTP port
  restrictions do not affect it. Confirm successful email delivery before
  enabling login in the public app.
- A reviewed repository revision containing these changes. Creating a Blueprint
  does not upload uncommitted local changes. Use this file's path when creating
  the Blueprint; the Docker build context must remain the repository root.

Free hosting can sleep, restart or impose quotas; it is suitable for an initial
personal trial, not an availability guarantee. A cloud database also needs a
backup policy. Keep periodic application JSON exports and database backups.

## Selected email service: Brevo Free

Checked against official documentation on 2026-10-25: Brevo Free includes
300 sends per day, including transactional email, with no plan time limit.
The template uses Brevo's HTTPS transactional-email API.
Account approval and sender verification are still
required; these files do not create a Brevo account.

Create a Free account, verify your sender, then create an API key with
transactional-email sending permission (Transactional email: All; other
resources: None). Put the key in `BREVO_API_KEY`, your verified sender address
in `BREVO_FROM_EMAIL`, and its display name in `BREVO_FROM_NAME` through Render's
environment settings. An API key is different from an SMTP key or account password.
Keep email open/click tracking disabled for login messages. Do not paste any
key into the chat or commit it.

For local configuration, fill those same three fields in the ignored
`packages/super-sync-server/.env` and start the backend from that directory so
dotenv loads it. This does not configure the public deployment: copy the values
privately into Render's environment settings when its service exists.
The backend still requires its database, JWT secret and public URL settings.

When an API key is configured, API delivery takes precedence over SMTP and does
not retry through another transport on failure. With no API key, existing SMTP
settings continue to work. Never put an API key in `SMTP_PASS`.

For a durable sender identity, Brevo recommends a domain you control with
DKIM/DMARC authentication. Without it, Brevo currently replaces the sender
address with its own compliant address as a temporary measure. Confirm your
account permits that arrangement and test delivery; do not assume domain
purchase is included in the free email plan or buy one without approval.

## Database and server

1. Create a Supabase PostgreSQL project in a nearby region. Keep SuperSync in a
   separate `supersync` schema, outside the schemas exposed by Supabase's Data
   API. Do not grant `anon` or `authenticated` access to this schema. Only the
   backend receives database credentials; they never go in frontend assets.
2. Get the actual connection string from **Connect → Session pooler**. Session
   mode uses port 5432 and supports IPv4. Preserve the dashboard's exact host
   and username. URL-encode the password. Append these query parameters (use
   `&` if the URL already has a query):

   ```text
   sslmode=require&schema=supersync&connection_limit=5&pool_timeout=10
   ```

   The migration role must be allowed to create/use that schema. The repository's
   migration script sets PostgreSQL startup options; verify the selected pooler
   supports them. If it rejects them, use an approved direct/session connection
   supporting those options; do not bypass migration checks or reset the DB.

3. Fill Render's secret environment fields prompted by `render.yaml`:

   | Field                           | Value                                               |
   | ------------------------------- | --------------------------------------------------- |
   | `DATABASE_URL`                  | The private connection string above                 |
   | `PUBLIC_URL`, `WEBAUTHN_ORIGIN` | Actual HTTPS backend origin                         |
   | `WEBAUTHN_RP_ID`                | Actual backend hostname, without protocol or port   |
   | `ALLOWED_EMAILS`                | Your exact email address(es), comma-separated       |
   | `BREVO_API_KEY`                 | API key with transactional-email sending permission |
   | `BREVO_FROM_EMAIL`              | The exact verified sender address                   |
   | `BREVO_FROM_NAME`               | Display name, for example Super Productivity        |

   Never use `TEST_MODE` as a production workaround.
   `JWT_SECRET` is generated by Render, not stored in
   this file. Preserve it across deploys. Keep `WEB_APP_URL` and `CORS_ORIGINS`
   aligned with the actual frontend origin.

4. Apply the reviewed Blueprint. Its first start runs the existing
   `scripts/migrate-deploy.sh` through the Dockerfile entry point; subsequent
   deploys apply only pending migrations. Use an empty dedicated schema for the
   first deployment. Do not use `db push`, `migrate reset`, or import LevelDB.
5. Check `/live` (process liveness), `/health` (database readiness), registration,
   verification and login email delivery. Check an authenticated request without
   credentials is rejected and one account cannot read another's data. The
   Blueprint keeps future automatic deploys off; applying it still starts the
   initial deployment and its migrations.

## Enable the frontend and first sync

After the backend is working, set `src/assets/cloud-account.json` to its HTTPS
origin, build the web app, and publish the reviewed build. The default
`{"serverUrl":null}` intentionally displays that cloud login is unavailable.
This public asset contains only a URL, never database credentials or JWT secrets.

Export a JSON backup from the device containing your current tasks before first
sync. Open **Account**, register through the server if necessary, then request a
login email. The one-use email link returns to the app, which opens existing
sync setup. Choose/enter your sync encryption password. Use the same account,
server and encryption password on the second device. Keep the existing conflict
dialogs; do not silently replace either device's tasks. Offline data remains in
each browser's IndexedDB and is synced when connectivity returns.

Changing accounts in a browser with another account configured is blocked by
the login shortcut. Export and deliberately separate local datasets before
changing identity through the normal sync controls. Email login does not recover
a forgotten sync encryption password.

## Navicat

Once the project exists, create a **PostgreSQL** connection using the exact
Session pooler host, port 5432, database name and username from Supabase's
Connect panel, with SSL enabled. Save the password in Navicat's credential
storage. Browse the `supersync` schema. These are SQL tables containing accounts,
encrypted operations and snapshots; task payloads are not plaintext task rows.
There is no local SQL database file corresponding to this hosted database.

## References

- [Render Blueprint configuration](https://render.com/docs/blueprint-spec)
- [Render free-service limitations](https://render.com/docs/free)
- [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Brevo SMTP ports](https://help.brevo.com/hc/en-us/articles/10905415650322-Which-SMTP-port-should-I-use-Port-587-465-or-2525)
- [Brevo transactional-email API](https://developers.brevo.com/reference/send-transac-email)
- [Brevo Free limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan)
- [Brevo sender requirements](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders)
