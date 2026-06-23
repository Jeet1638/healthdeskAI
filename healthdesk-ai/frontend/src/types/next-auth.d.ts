import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    access_token: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      clinic_id: string;
      access_token: string;
    };
  }

  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    role: string;
    clinic_id: string;
    access_token: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    clinic_id: string;
    access_token: string;
    google_id_token?: string;
  }
}
