import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { prisma } from "@/db/client";

const providers: NextAuthConfig["providers"] = [];

const hasGoogleCreds = !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;
if (hasGoogleCreds) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  );
}

const devSecret = process.env.AUTH_DEV_SECRET;
const allowDevCredentials =
  process.env.NODE_ENV === "development" && typeof devSecret === "string" && devSecret.length >= 8;

if (allowDevCredentials) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Development",
      credentials: {
        secret: { label: "Dev secret", type: "password" },
      },
      async authorize(credentials) {
        const submitted = credentials?.secret;
        if (typeof submitted !== "string" || submitted !== devSecret) {
          return null;
        }
        const email = process.env.AUTH_DEV_EMAIL?.trim() || "dev@drinkanddraw.local";
        const name = "Local dev";
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              name,
              emailVerified: new Date(),
            },
          });
        }
        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  );
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      handle: string | null;
      role: "USER" | "ADMIN";
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
      }
      const id = token.sub;
      if (typeof id === "string") {
        const full = await prisma.user.findUnique({
          where: { id },
          select: { handle: true, role: true },
        });
        token.handle = full?.handle ?? null;
        token.role = (full?.role ?? "USER") as "USER" | "ADMIN";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        const handle = token.handle;
        session.user.handle = typeof handle === "string" || handle === null ? handle : null;
        const role = token.role;
        session.user.role = role === "ADMIN" ? "ADMIN" : "USER";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
