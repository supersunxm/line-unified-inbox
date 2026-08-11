import { Injectable } from "@nestjs/common";

function bool(value: string | undefined) { return value?.trim().toLowerCase() === "true"; }

@Injectable()
export class MobileConfigService {
  get(environment = process.env) {
    return {
      minimumAppVersion: environment.MOBILE_MIN_APP_VERSION?.trim() || "1.0.0",
      maintenance: {
        enabled: bool(environment.MOBILE_MAINTENANCE_ENABLED),
        message: environment.MOBILE_MAINTENANCE_MESSAGE?.trim() || null,
      },
    };
  }
}
