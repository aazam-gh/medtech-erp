import { SetMetadata } from "@nestjs/common";

export interface RequiredPermission {
  module: string;
  action: string;
}

export const REQUIRED_PERMISSION = "requiredPermission";

export function RequirePermission(module: string, action: string) {
  return SetMetadata(REQUIRED_PERMISSION, { module, action } satisfies RequiredPermission);
}
