import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    appJwt?: string;
    error?: string;
    user: {
      id?: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      onboarded?: boolean;
      firstName?: string | null;
      photoUrl?: string | null;
      role?: "user" | "admin";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    appJwt?: string;
    backendUser?: {
      id: string;
      email: string;
      onboarded: boolean;
      first_name: string | null;
      photo_url: string | null;
      role: "user" | "admin";
    };
    error?: string;
  }
}
