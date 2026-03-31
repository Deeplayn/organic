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

Production examples:

- `https://your-domain.com/api/auth/oauth/callback?provider=google`
- `https://your-domain.com/api/auth/oauth/callback?provider=microsoft`
- `https://your-domain.com/api/auth/oauth/callback?provider=github`

Local development examples:

- `http://localhost:3000/api/auth/oauth/callback?provider=google`
- `http://localhost:3000/api/auth/oauth/callback?provider=microsoft`
- `http://localhost:3000/api/auth/oauth/callback?provider=github`

## Notes

- Users created through OAuth are stored in `users` with `password_hash = NULL`.
- Provider identities are linked in `oauth_identities`.
- If an email already exists in `users`, OAuth will link that provider to the existing account.
- The backend now detects `http://localhost` correctly when proxy headers are missing, so local callback URLs no longer default to `https`.
