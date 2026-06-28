export interface AuthenticatedRole {
  code: string;
  name: string;
}

export interface AuthenticatedPermission {
  code: string;
  module: string;
  action: string;
}

export interface AuthenticatedUser {
  id: string;
  identityProvider: string;
  identitySubject: string;
  email: string;
  fullName: string;
  roles: AuthenticatedRole[];
  permissions: AuthenticatedPermission[];
}
