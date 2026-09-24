import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      currentOrgId: string | null;
      currentOrgName: string | null;
      currentOrgRole: "owner" | "admin" | "member" | null;
    } & DefaultSession["user"];
  }
}
