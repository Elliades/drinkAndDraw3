import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/db/client";
import { authConfig } from "./auth.config";
import { nodeAuthConfig } from "./config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [...authConfig.providers, ...nodeAuthConfig.providers],
  callbacks: nodeAuthConfig.callbacks,
  adapter: PrismaAdapter(prisma),
});
