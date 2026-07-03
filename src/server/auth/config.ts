import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token.userId === "string") session.user.id = token.userId;
      if (token.role === "ADMIN" || token.role === "PATIENT") {
        session.user.role = token.role;
      }
      if (typeof token.mustChangePassword === "boolean") {
        session.user.mustChangePassword = token.mustChangePassword;
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const user = auth?.user;

      if (pathname.startsWith("/admin")) return user?.role === "ADMIN";
      if (pathname.startsWith("/app")) return user?.role === "PATIENT";
      return true; // /login, /change-password e / cuidam de si mesmas
    },
  },
  providers: [], // preenchido em index.ts (provider usa bcrypt, não é edge-safe)
} satisfies NextAuthConfig;
