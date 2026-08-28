import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { CredentialEncryptionService } from "./credential-encryption.service";
import { LineStatelessTokenService } from "./line-stateless-token.service";

@Global()
@Module({
  imports: [PrismaModule],
  providers: [CredentialEncryptionService, LineStatelessTokenService],
  exports: [CredentialEncryptionService, LineStatelessTokenService],
})
export class CredentialsModule {}
