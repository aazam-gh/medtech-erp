import { Inject, Injectable } from "@nestjs/common";
import { KyselyProvider } from "../database/kysely.provider";
import type { AuthenticatedUser } from "../auth/auth.types";

@Injectable()
export class ProfilesService {
  constructor(@Inject(KyselyProvider) private readonly database: KyselyProvider) {}

  async loadAuthenticatedUser(identitySubject: string): Promise<AuthenticatedUser | null> {
    const profile = await this.database.db
      .selectFrom("profiles")
      .select(["id", "identity_provider", "identity_subject", "email", "full_name"])
      .where("identity_provider", "=", "local")
      .where("identity_subject", "=", identitySubject)
      .where("is_active", "=", true)
      .executeTakeFirst();

    if (!profile) return null;

    const roles = await this.database.db
      .selectFrom("user_roles")
      .innerJoin("roles", "roles.id", "user_roles.role_id")
      .select(["roles.code", "roles.name"])
      .where("user_roles.user_id", "=", profile.id)
      .execute();

    const permissions = await this.database.db
      .selectFrom("user_roles")
      .innerJoin("role_permissions", "role_permissions.role_id", "user_roles.role_id")
      .innerJoin("permissions", "permissions.id", "role_permissions.permission_id")
      .select(["permissions.code", "permissions.module", "permissions.action"])
      .where("user_roles.user_id", "=", profile.id)
      .execute();

    return {
      id: profile.id,
      identityProvider: profile.identity_provider,
      identitySubject: profile.identity_subject,
      email: profile.email,
      fullName: profile.full_name,
      roles,
      permissions
    };
  }
}
