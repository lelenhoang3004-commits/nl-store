# Security Review

## Scope

This document records the current security architecture and recommended production checklist for the fashion store project.

## XSS

- Frontend components should continue using `escapeHtml` before injecting dynamic HTML.
- Backend now trims request strings and removes prototype-pollution keys before validation.
- Helmet CSP is centralized in `backend/config/security.config.js`.
- Production recommendation: avoid inline scripts and move any inline style exceptions out of CSP when assets are bundled.

## CSRF

- CSRF architecture is available through `backend/middleware/csrf.middleware.js`.
- Enable with `CSRF_ENABLED=true`.
- Frontend should first request `GET /api/v1/security/csrf-token`, then send the returned token in `X-CSRF-Token` for unsafe methods.
- Refresh-token cookies are signed and HTTP-only; CSRF is still recommended when cookie credentials are used.

## SQL Injection

- Repository modules should only use parameterized `mysql2/promise` placeholders.
- Never concatenate search, sort, or filter values directly into SQL.
- Keep allowlists for sortable/filterable fields in services.

## Rate Limit

- Global, auth, and upload rate limiters exist.
- Tune `RATE_LIMIT_*`, `AUTH_RATE_LIMIT_*`, and `UPLOAD_RATE_LIMIT_*` per environment.
- Recommended production addition: separate stricter limits for password reset and OTP endpoints.

## JWT

- Access and refresh tokens use different secrets.
- Tokens now include and verify `issuer` and `audience`.
- Access tokens should remain short-lived; refresh tokens should be rotated.
- Do not store access tokens in long-lived localStorage for production if a BFF/session-cookie model is later adopted.

## Cookie

- Refresh token cookie is signed, HTTP-only, and scoped to the auth path.
- Production should use HTTPS with `secure=true`.
- For cross-site admin domains, keep `sameSite=none`; otherwise prefer `lax` or `strict`.

## Upload

- Image uploads validate MIME type and extension.
- General file uploads now validate MIME type and extension.
- Uploaded files are renamed with UUIDs.
- Recommended production addition: virus scan, image dimension limits, EXIF stripping, and private object storage.

## Validation

- Backend validators are split by domain.
- Request sanitization runs before route handlers.
- Keep validation duplicated at frontend for UX, but treat backend validation as the source of truth.

## CORS

- Allowed origins are environment driven.
- Credentials are enabled, so origins must stay explicit.
- Never use wildcard origins with cookies or Authorization headers.

## Helmet

- Helmet is applied globally.
- CSP, frame ancestors, object-src, and base-uri are centralized.
- Review CSP when adding external CDN assets to backend-served pages.

## Password

- Password hashing is centralized with bcrypt.
- Strong password validation exists for user creation and reset flows.
- Recommended production addition: breached-password checks and password reset token expiry/audit logging.

## Permission

- Route permissions are enforced on backend middleware and mirrored in frontend guards.
- Backend permissions are the authority; frontend permissions are only UX.
- Recommended production addition: audit all permission changes and require admin re-auth for role updates.
