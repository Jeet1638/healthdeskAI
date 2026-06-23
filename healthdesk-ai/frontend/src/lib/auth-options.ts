import axios from "axios";
import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

const API_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api/v1";

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }
        try {
          const response = await axios.post(`${API_URL}/auth/login`, {
            email: credentials.email,
            password: credentials.password,
          });
          const data = response.data;
          if (data?.access_token) {
            return {
              id: data.user.id,
              name: data.user.name,
              email: data.user.email,
              role: data.user.role,
              clinic_id: data.user.clinic_id,
              access_token: data.access_token,
            };
          }
          return null;
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          const response = await axios.post(`${API_URL}/auth/google`, {
            id_token: account.id_token,
          });
          const data = response.data;
          if (data?.access_token) {
            user.id = data.user.id;
            user.name = data.user.name;
            user.email = data.user.email;
            user.role = data.user.role;
            user.clinic_id = data.user.clinic_id;
            user.access_token = data.access_token;
            return true;
          }
          return false;
        } catch (error) {
          if (
            axios.isAxiosError(error) &&
            typeof error.response?.data?.detail === "string" &&
            error.response.data.detail.toLowerCase().includes("already registered")
          ) {
            return "/login?error=OAuthAccountNotLinked";
          }
          console.error("Google sign-in backend error:", error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.clinic_id = user.clinic_id;
        token.access_token = user.access_token;
      }
      if (account?.provider === "google" && account.id_token) {
        token.google_id_token = account.id_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.clinic_id = token.clinic_id;
        session.user.access_token = token.access_token;
        session.access_token = token.access_token;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
};
