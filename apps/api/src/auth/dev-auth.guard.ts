import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { ProfilesService } from "../profiles/profiles.service";

@Injectable()
export class DevAuthGuard implements CanActivate {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(ProfilesService) private readonly profiles: ProfilesService
  ) {}

  async canActivate(context: ExecutionContext) {
    const authMode = this.config.get<string>("AUTH_MODE") ?? "local";
    if (authMode !== "local") {
      throw new UnauthorizedException("Only local auth mode is implemented.");
    }

    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const identitySubject = getHeaderValue(request, "x-dev-user");
    if (!identitySubject) {
      throw new UnauthorizedException("x-dev-user is required in local auth mode.");
    }

    const user = await this.profiles.loadAuthenticatedUser(identitySubject);
    if (!user) {
      throw new UnauthorizedException("Local user was not found.");
    }

    request.user = user;
    return true;
  }
}

function getHeaderValue(request: Request, header: string) {
  const value = request.headers[header];
  if (Array.isArray(value)) return value[0];
  return value;
}
