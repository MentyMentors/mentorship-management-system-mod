import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";
import { loginSchema } from "@/lib/validators";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    /**
     * Server-side (Node) token check. Runs on every auth() call: the token is
     * rejected when the account is no longer approved or its sessionVersion
     * has moved on (role, status or membership changed). Returning null
     * ends the session. The edge middleware uses the lighter callback in
     * auth.config.ts, so this never runs without database access.
     */
    async jwt(params) {
      const token = authConfig.callbacks.jwt(params);
      if (params.user) {
        token.sessionVersion = params.user.sessionVersion ?? 0;
        return token;
      }
      if (!token.id) return null;
      const current = await db.user.findUnique({
        where: { id: token.id },
        select: { role: true, status: true, sessionVersion: true },
      });
      if (
        !current ||
        current.status !== "APPROVED" ||
        current.sessionVersion !== (token.sessionVersion ?? 0)
      ) {
        return null;
      }
      token.role = current.role;
      token.status = current.status;
      return token;
    },
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // Only verified, approved accounts may log in. Returning null
        // keeps the reason opaque to the client; the login form checks
        // status via the register/status endpoint for a friendlier
        // message.
        if (!user.emailVerifiedAt) return null;
        if (user.status !== "APPROVED") return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
});
