import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js configuration (no Prisma imports) shared by the
 * middleware and the full server-side auth instance.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8, // 8 hours
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.status = user.status;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.status = token.status;
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const user = auth?.user;

      const isPublic =
        pathname === "/" ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/register") ||
        pathname.startsWith("/pending") ||
        pathname.startsWith("/forgot-password") ||
        pathname.startsWith("/reset-password") ||
        pathname.startsWith("/verify-email") ||
        pathname.startsWith("/p/") ||
        pathname.startsWith("/invite/");

      if (isPublic) {
        return true;
      }

      if (!user) {
        return false; // redirects to the sign-in page
      }

      if (user.status !== "APPROVED") {
        return Response.redirect(new URL("/pending", request.nextUrl));
      }

      const roleHome: Record<string, string> = {
        ADMIN: "/admin",
        MENTOR: "/mentor",
        MENTEE: "/mentee",
        USER: "/manage",
      };

      if (pathname.startsWith("/admin") && user.role !== "ADMIN") {
        return Response.redirect(new URL(roleHome[user.role], request.nextUrl));
      }
      if (pathname.startsWith("/mentor") && user.role !== "MENTOR") {
        return Response.redirect(new URL(roleHome[user.role], request.nextUrl));
      }
            if (pathname.startsWith("/mentee") && user.role !== "MENTEE") {
        return Response.redirect(new URL(roleHome[user.role], request.nextUrl));
      }
      if (pathname.startsWith("/search") && user.role !== "ADMIN") {
        return Response.redirect(new URL(roleHome[user.role], request.nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
