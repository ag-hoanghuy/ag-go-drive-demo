export interface AuthenticatedUser {
  sub: string;
  email: string | null;
  name: string | null;
}

export interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  user?: AuthenticatedUser;
}

