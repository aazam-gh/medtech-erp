import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";

@Injectable()
export class PermissionsService {
  hasPermission(user: AuthenticatedUser, module: string, action: string) {
    if (user.roles.some((role) => role.code === "super_admin")) return true;

    return user.permissions.some((permission) => {
      return permission.module === module && (permission.action === action || permission.action === "admin");
    });
  }
}
