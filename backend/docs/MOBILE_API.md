# Android mobile API contract

All protected endpoints use `Authorization: Bearer <accessToken>`. The backend never accepts a mobile-supplied store ID or LINE OA ID for conversation access or replies.

## Authentication

1. Call `POST /auth/mobile/send-otp` with `{ "phone": "0812345678" }`.
2. Call `POST /auth/mobile/verify-otp` with the returned `challengeId` and the six-digit OTP. A successful response contains `accessToken` and `expiresAt`.
3. Send the bearer token on `GET /auth/me`, `/mobile/*`, and device-token calls.
4. On `401` with `code: "SESSION_EXPIRED"`, remove the token and repeat OTP login. There is no refresh token in this phase.
5. Call `POST /auth/mobile/logout` with the bearer token when the user signs out.

`GET /auth/me` returns profile fields, active memberships, assigned stores, platform role, membership roles, and derived permissions.

## App bootstrap

`GET /mobile/config` is public and returns `minimumAppVersion` plus maintenance state. Android should block or warn according to its app-version policy and show the maintenance message when enabled.

## Conversations

- `GET /mobile/conversations?page=1&pageSize=30` returns the authenticated user's accessible inbox with last-message preview, unread count, and BM reply status.
- `GET /mobile/conversations/:id` returns the accessible conversation's latest 50 messages.
- `POST /mobile/conversations/:id/messages` accepts only `{ "text", "idempotencyKey" }`. The backend resolves ownership and the connected LINE OA from the persisted conversation.

Cross-store resources return `403` with `code: "ACCESS_DENIED"`; missing resources return `404` with `code: "RESOURCE_NOT_FOUND"`.

## Notifications

FCM data includes only `conversationId`, `messageId`, and `notificationId`. Android opens the conversation using the ID and then calls `PATCH /mobile/notifications/:id/opened`. Use `PATCH /mobile/notifications/:id/read` when the notification is read without opening. `GET /mobile/notifications/unread-count` supplies the badge count.
