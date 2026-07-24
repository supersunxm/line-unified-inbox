export class IdentifyFriendAttributionDto {
  sessionToken!: string;
  idToken?: string;
  accessToken?: string;
  consentGiven!: boolean;
}

export class UpdateFriendshipStatusDto {
  sessionToken!: string;
  isFriend!: boolean;
}
