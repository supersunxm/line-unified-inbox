-- Phase 1A: additive mobile identity and notification foundation.
-- Existing ADMIN/VIEWER accounts remain ACTIVE and retain their password hashes.

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REJECTED');
CREATE TYPE "StoreMembershipRole" AS ENUM ('STORE_MANAGER', 'STAFF');
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED');
CREATE TYPE "RegistrationRequestStatus" AS ENUM ('OTP_PENDING', 'PENDING_APPROVAL', 'COMPLETED', 'REJECTED', 'EXPIRED');
CREATE TYPE "MobileOtpPurpose" AS ENUM ('BM_STAFF_REGISTRATION', 'BM_STAFF_LOGIN');
CREATE TYPE "DevicePlatform" AS ENUM ('ANDROID', 'IOS');
CREATE TYPE "PushNotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

ALTER TABLE "User"
  ALTER COLUMN "passwordHash" DROP NOT NULL,
  ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "firstName" TEXT,
  ADD COLUMN "lastName" TEXT,
  ADD COLUMN "employeeId" TEXT,
  ADD COLUMN "position" TEXT,
  ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

CREATE TABLE "UserStoreMembership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "role" "StoreMembershipRole" NOT NULL,
  "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "isPrimary" BOOLEAN NOT NULL DEFAULT true,
  "approvedAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserStoreMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegistrationRequest" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "normalizedEmail" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "position" TEXT NOT NULL,
  "requestedRole" "StoreMembershipRole" NOT NULL DEFAULT 'STAFF',
  "status" "RegistrationRequestStatus" NOT NULL DEFAULT 'OTP_PENDING',
  "otpVerifiedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegistrationRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OtpChallenge" (
  "id" TEXT NOT NULL,
  "registrationId" TEXT,
  "userId" TEXT,
  "normalizedPhone" TEXT NOT NULL,
  "purpose" "MobileOtpPurpose" NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "resendAvailableAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeviceToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" "DevicePlatform" NOT NULL,
  "appVersion" TEXT,
  "deviceIdHash" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushNotification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "PushNotificationStatus" NOT NULL DEFAULT 'QUEUED',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE INDEX "User_status_idx" ON "User"("status");
CREATE INDEX "User_employeeId_idx" ON "User"("employeeId");
CREATE UNIQUE INDEX "UserStoreMembership_userId_storeId_key" ON "UserStoreMembership"("userId", "storeId");
CREATE INDEX "UserStoreMembership_storeId_status_idx" ON "UserStoreMembership"("storeId", "status");
CREATE INDEX "UserStoreMembership_userId_status_idx" ON "UserStoreMembership"("userId", "status");
CREATE INDEX "RegistrationRequest_phone_status_idx" ON "RegistrationRequest"("phone", "status");
CREATE INDEX "RegistrationRequest_normalizedEmail_status_idx" ON "RegistrationRequest"("normalizedEmail", "status");
CREATE INDEX "RegistrationRequest_employeeId_storeId_idx" ON "RegistrationRequest"("employeeId", "storeId");
CREATE INDEX "RegistrationRequest_expiresAt_idx" ON "RegistrationRequest"("expiresAt");
CREATE INDEX "OtpChallenge_normalizedPhone_purpose_idx" ON "OtpChallenge"("normalizedPhone", "purpose");
CREATE INDEX "OtpChallenge_registrationId_idx" ON "OtpChallenge"("registrationId");
CREATE INDEX "OtpChallenge_userId_idx" ON "OtpChallenge"("userId");
CREATE INDEX "OtpChallenge_expiresAt_idx" ON "OtpChallenge"("expiresAt");
CREATE INDEX "OtpChallenge_consumedAt_idx" ON "OtpChallenge"("consumedAt");
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");
CREATE INDEX "DeviceToken_userId_isActive_idx" ON "DeviceToken"("userId", "isActive");
CREATE INDEX "PushNotification_status_createdAt_idx" ON "PushNotification"("status", "createdAt");
CREATE INDEX "PushNotification_userId_createdAt_idx" ON "PushNotification"("userId", "createdAt");
CREATE INDEX "PushNotification_conversationId_createdAt_idx" ON "PushNotification"("conversationId", "createdAt");
CREATE INDEX "PushNotification_messageId_idx" ON "PushNotification"("messageId");

ALTER TABLE "UserStoreMembership"
  ADD CONSTRAINT "UserStoreMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UserStoreMembership_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "UserStoreMembership_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RegistrationRequest"
  ADD CONSTRAINT "RegistrationRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "RegistrationRequest_createdUserId_fkey" FOREIGN KEY ("createdUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OtpChallenge"
  ADD CONSTRAINT "OtpChallenge_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "RegistrationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "OtpChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeviceToken"
  ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PushNotification"
  ADD CONSTRAINT "PushNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PushNotification_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PushNotification_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
