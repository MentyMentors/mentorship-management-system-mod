import type { Role, UserStatus } from "@prisma/client";
import type { DefaultSession } from "next-auth";
import type {} from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      status: UserStatus;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    role: Role;
    status: UserStatus;
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    status: UserStatus;
    sessionVersion?: number;
  }
}
