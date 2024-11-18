import got, { Got, Headers, HTTPError } from "got";
import { jwtDecode } from "jwt-decode";
import {
  getResponseData,
  GraphQLDataResponse,
  GraphQLRequest,
  GraphQLResponse,
} from "./graphql.js";
import { rootLogger } from "./logger.js";
import { asError } from "catch-unknown";

const logger = rootLogger.child({ module: "FittFinderApi" });

interface LoginResponse {
  token: string;
  refreshToken?: string;
}

interface JwtClaims {
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  sub: string;
  jti?: string;
  authenticationType: string;
  email?: string;
  email_verified?: boolean;
  preferred_username?: string;
  applicationId?: string;
  roles?: string[];
}

export class FittFinderApi {
  private readonly agent: Got;
  private apiAccessToken?: string;
  private apiTokenExpiration: number | undefined;

  public constructor(
    url: string,
    private readonly username: string,
    private readonly password: string,
    userAgent = "FITT Finder API Example"
  ) {
    this.agent = got.extend({
      prefixUrl: url,
      headers: {
        "user-agent": userAgent,
      },
      responseType: "json",
    });
  }

  public async apiRequest(body: GraphQLRequest): Promise<GraphQLDataResponse> {
    const response = await this.apiRequestChecked(body);
    try {
      getResponseData(response, body);
      return response as GraphQLDataResponse;
    } catch (e) {
      logger.warn(
        `API request failed: ${JSON.stringify({ error: e, body, response })}`
      );
      throw e;
    }
  }

  public async apiRequestChecked(
    body: GraphQLRequest
  ): Promise<GraphQLResponse> {
    const headers: Headers = {};
    const options = { headers, json: body };
    for (let authRetry = false; ; ) {
      headers.authorization = await this.getAuthHeader();
      try {
        const response = await this.agent.post<GraphQLResponse>(
          "graphql",
          options
        );
        return response.body;
      } catch (e) {
        if (e instanceof HTTPError) {
          if (e.response.statusCode === 401 && !authRetry) {
            this.apiAccessToken = undefined;
            this.apiTokenExpiration = undefined;
            authRetry = true;
            continue;
          }

          const { body } = e.response;
          if (Array.isArray(body?.errors)) {
            const errors: { message: string }[] = body.errors.filter(
              (error: Error) => typeof error?.message === "string"
            );
            if (errors.length > 0) {
              throw new Error(
                `API request failed: ${errors.map((e) => e.message).join(", ")}`
              );
            }
          }
        }
        throw e;
      }
    }
  }

  private async getAuthHeader(): Promise<string | undefined> {
    const hasValidToken =
      this.apiTokenExpiration != null &&
      this.apiTokenExpiration > Date.now() / 1000;
    if (!hasValidToken && this.username && this.password) {
      try {
        const response = await this.agent.post<LoginResponse>("login", {
          json: {
            loginId: this.username,
            password: this.password,
          },
        });
        const { token } = response.body;
        const claims = jwtDecode<JwtClaims>(token);
        logger.debug(
          `Authenticated to ${claims.aud} as ${claims.sub} with role(s) ${claims.roles?.join(", ")}`
        );
        this.apiAccessToken = token;
        this.apiTokenExpiration = claims.exp;
      } catch (e) {
        logger.warn(`Login failed: ${asError(e).message}`);
        throw e;
      }
    }

    if (this.apiAccessToken) {
      return `Bearer ${this.apiAccessToken}`;
    }
  }
}

export function createFittFinderApi(): FittFinderApi {
  const {
    FITTFINDER_API_URL,
    FITTFINDER_API_USERNAME,
    FITTFINDER_API_PASSWORD,
  } = process.env;
  if (!FITTFINDER_API_URL) {
    throw new Error("FITTFINDER_API_URL not configured");
  }
  if (!FITTFINDER_API_USERNAME) {
    throw new Error("FITTFINDER_API_USERNAME not configured");
  }
  if (!FITTFINDER_API_PASSWORD) {
    throw new Error("FITTFINDER_API_PASSWORD not configured");
  }
  return new FittFinderApi(
    FITTFINDER_API_URL,
    FITTFINDER_API_USERNAME,
    FITTFINDER_API_PASSWORD
  );
}
