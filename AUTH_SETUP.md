# OAuth Setup

This project already supports login with Google, Microsoft, and GitHub through:

- `/api/auth/oauth/start?provider=google`
- `/api/auth/oauth/start?provider=microsoft`
- `/api/auth/oauth/start?provider=github`

Each provider redirects back to:

- Google: `/api/auth/oauth/callback?provider=google`
- Microsoft: `/api/auth/oauth/callback?provider=microsoft`
- GitHub: `/api/auth/oauth/callback?provider=github`

## Required environment variables

Add these values in your deployment environment and local `.env`:

```env
DATABASE_URL=postgres://username:password@host:5432/database
EXPORT_DATABASE_URL=postgres://username:password@host:5432/database
APP_BASE_URL=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com,http://localhost:3000
AUTH_SESSION_DAYS=30
AUTH_STATE_SECRET=replace-with-a-long-random-secret

GOOGLE_CLIENT_ID=replace-with-google-client-id
GOOGLE_CLIENT_SECRET=replace-with-google-client-secret

MICROSOFT_CLIENT_ID=replace-with-microsoft-client-id
MICROSOFT_CLIENT_SECRET=replace-with-microsoft-client-secret
MICROSOFT_TENANT_ID=common

GITHUB_CLIENT_ID=replace-with-github-client-id
GITHUB_CLIENT_SECRET=replace-with-github-client-secret
```

## Redirect URI examples

Register the callback URL for each provider with your real domain.
Set `APP_BASE_URL` to that same production origin so OAuth always starts and finishes on the exact host registered with Google.

Production examples:

- `https://your-domain.com/api/auth/oauth/callback?provider=google`
- `https://your-domain.com/api/auth/oauth/callback?provider=microsoft`
- `https://your-domain.com/api/auth/oauth/callback?provider=github`

Local development examples:

- `http://localhost:3000/api/auth/oauth/callback?provider=google`
- `http://localhost:3000/api/auth/oauth/callback?provider=microsoft`
- `http://localhost:3000/api/auth/oauth/callback?provider=github`

## Microsoft app registration checklist

In Microsoft Entra ID or Azure Portal, register a web application for this app and make sure:

- The platform type is `Web`.
- The redirect URI is exactly:
  `http://localhost:3000/api/auth/oauth/callback?provider=microsoft`
  for local development, and
  `https://your-domain.com/api/auth/oauth/callback?provider=microsoft`
  for production.
- You create a client secret and copy both the `Application (client) ID` and the secret value into:
  `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`.
- `MICROSOFT_TENANT_ID=common` works for personal and work/school Microsoft accounts.
  If you want only one tenant to sign in, replace `common` with that tenant ID.
- Your local `.env` must include `AUTH_STATE_SECRET`, `MICROSOFT_CLIENT_ID`, and `MICROSOFT_CLIENT_SECRET`.
  Without them, the app will refuse to start Microsoft OAuth.

## Notes

- Users created through OAuth are stored in `users` with `password_hash = NULL`.
- Provider identities are linked in `oauth_identities`.
- If an email already exists in `users`, OAuth will link that provider to the existing account.
- `npm run export-db` uses `EXPORT_DATABASE_URL` when it is set, and falls back to `DATABASE_URL` otherwise.
- The backend now detects `http://localhost` correctly when proxy headers are missing, so local callback URLs no longer default to `https`.
- If you use both a Vercel preview URL and a custom domain, set `APP_BASE_URL` to the custom domain. The OAuth start and callback endpoints will redirect to that host before creating or validating OAuth state.
