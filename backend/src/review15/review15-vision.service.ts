import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createSign } from "node:crypto";
import {
  extractReviewCandidatesFromVision,
  ReviewVisionCandidate,
  VisionFullTextAnnotation,
} from "./review15-vision-layout";
import { readGoogleTranslationProviderOptions } from "../translation/translation.config";

type VisionAnnotateResponse = {
  responses?: Array<{
    error?: {
      code?: number;
      message?: string;
      status?: string;
    } | null;
    fullTextAnnotation?: VisionFullTextAnnotation | null;
  }> | null;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
};

export type Review15VisionScanResult = {
  provider: "google-cloud-vision";
  candidates: Array<
    ReviewVisionCandidate & {
      imageIndex: number;
    }
  >;
  imagesProcessed: number;
};

function base64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

@Injectable()
export class Review15VisionService {
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  private getGoogleConfig() {
    const config = readGoogleTranslationProviderOptions(process.env);
    if (!config) {
      throw new ServiceUnavailableException(
        "Google Vision credentials are not configured",
      );
    }
    return config;
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.accessTokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const config = this.getGoogleConfig();
    const issuedAt = Math.floor(now / 1000);
    const expiresAt = issuedAt + 3600;
    const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = base64Url(
      JSON.stringify({
        iss: config.credentials.client_email,
        scope: "https://www.googleapis.com/auth/cloud-platform",
        aud: "https://oauth2.googleapis.com/token",
        iat: issuedAt,
        exp: expiresAt,
      }),
    );
    const unsigned = header + "." + payload;
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    const signature = signer.sign(config.credentials.private_key);
    const assertion = unsigned + "." + base64Url(signature);

    let response: Response;
    try {
      response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
        }),
      });
    } catch {
      throw new BadGatewayException("Google Vision authentication failed");
    }

    if (!response.ok) {
      throw new BadGatewayException("Google Vision authentication failed");
    }

    const body = (await response.json()) as TokenResponse;
    if (!body.access_token) {
      throw new BadGatewayException("Google Vision authentication failed");
    }

    this.accessToken = body.access_token;
    this.accessTokenExpiresAt =
      now + Math.max(300, body.expires_in ?? 3600) * 1000;
    return body.access_token;
  }

  async scan(images: Buffer[]): Promise<Review15VisionScanResult> {
    if (!images.length) {
      return {
        provider: "google-cloud-vision",
        candidates: [],
        imagesProcessed: 0,
      };
    }

    const token = await this.getAccessToken();

    let response: Response;
    try {
      response = await fetch(
        "https://vision.googleapis.com/v1/images:annotate",
        {
          method: "POST",
          headers: {
            authorization: "Bearer " + token,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            requests: images.map((image) => ({
              image: {
                content: image.toString("base64"),
              },
              features: [
                {
                  type: "DOCUMENT_TEXT_DETECTION",
                  maxResults: 1,
                },
              ],
              imageContext: {
                languageHints: ["th", "en"],
              },
            })),
          }),
        },
      );
    } catch {
      throw new BadGatewayException("Google Vision request failed");
    }

    if (!response.ok) {
      if (response.status === 403) {
        throw new ServiceUnavailableException(
          "Google Cloud Vision API is not enabled for this project",
        );
      }
      throw new BadGatewayException("Google Vision request failed");
    }

    const body = (await response.json()) as VisionAnnotateResponse;
    const results = body.responses ?? [];

    const candidates: Review15VisionScanResult["candidates"] = [];

    results.forEach((result, imageIndex) => {
      if (result.error) {
        return;
      }

      const extracted = extractReviewCandidatesFromVision(
        result.fullTextAnnotation,
      );

      extracted.forEach((candidate) => {
        candidates.push({
          ...candidate,
          imageIndex,
        });
      });
    });

    return {
      provider: "google-cloud-vision",
      candidates,
      imagesProcessed: images.length,
    };
  }
}
