import { Injectable, NotFoundException } from "@nestjs/common";
import { CredentialEncryptionService } from "./credentials/credential-encryption.service";
import { PrismaService } from "./prisma.service";

@Injectable()
export class LineProfileService {
  constructor(private readonly prisma: PrismaService, private readonly encryption: CredentialEncryptionService) {}

  async refresh(customerId: string, lineOfficialAccountId: string, force = false, source = "LINE_PROFILE_REFRESH") {
    const [customer, oa] = await Promise.all([this.prisma.customer.findUnique({ where: { id: customerId } }), this.prisma.lineOfficialAccount.findUnique({ where: { id: lineOfficialAccountId } })]);
    if (!customer || !oa) throw new NotFoundException("Customer or LINE OA not found");
    if (!customer.lineUserId) return this.prisma.customer.update({ where: { id: customerId }, data: { profileFetchStatus: "USER_UNAVAILABLE", profileFetchError: null } });
    const staleBefore = Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (!force && customer.displayName !== "LINE Customer" && customer.profileFetchedAt && customer.profileFetchedAt.getTime() > staleBefore) return customer;
    if (!oa.encryptedChannelAccessToken) return this.prisma.customer.update({ where: { id: customerId }, data: { profileFetchStatus: "TOKEN_UNAVAILABLE", profileFetchError: null } });
    let token: string;
    try { token = this.encryption.decrypt(oa.encryptedChannelAccessToken); }
    catch { return this.prisma.customer.update({ where: { id: customerId }, data: { profileFetchStatus: "TOKEN_UNAVAILABLE", profileFetchError: "Credential re-entry required" } }); }
    try {
      const response = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(customer.lineUserId)}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`LINE profile request failed (${response.status})`);
      const profile = await response.json() as { displayName?: string; pictureUrl?: string; statusMessage?: string; language?: string };
      const displayName = profile.displayName?.slice(0, 200) || customer.displayName;
      const updated = await this.prisma.customer.update({ where: { id: customerId }, data: { displayName, pictureUrl: profile.pictureUrl?.slice(0, 1000), statusMessage: profile.statusMessage?.slice(0, 500), preferredLanguage: profile.language?.slice(0, 20), profileFetchedAt: new Date(), profileFetchStatus: "SUCCESS", profileFetchError: null } });
      if (updated.displayName !== customer.displayName) {
        await this.prisma.customerNameHistory.create({ data: { customerId, displayName: updated.displayName, source } });
      }
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message.replace(/[\r\n]/g, " ").slice(0, 200) : "LINE profile request failed";
      return this.prisma.customer.update({ where: { id: customerId }, data: { profileFetchedAt: new Date(), profileFetchStatus: "FAILED", profileFetchError: message } });
    }
  }
}
