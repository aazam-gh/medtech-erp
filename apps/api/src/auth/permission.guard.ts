import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { AuthenticatedUser } from "./auth.types";
import { PermissionsService } from "../permissions/permissions.service";
import { REQUIRED_PERMISSION, type RequiredPermission } from "./permission.decorator";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PermissionsService) private readonly permissions: PermissionsService
  ) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(REQUIRED_PERMISSION, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user || !this.permissions.hasPermission(user, required.module, required.action)) {
      throw new ForbiddenException("Permission denied.");
    }

    return true;
  }
}
