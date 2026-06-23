import type { TokenResponse } from "@/types/api";

export const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export async function backendLogin(email: string, password: string): Promise<TokenResponse> {
  const response = await fetch(`${BACKEND_API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error("Invalid email or password");
  }

  return (await response.json()) as TokenResponse;
}

export async function backendGoogleLogin(idToken: string): Promise<TokenResponse> {
  const response = await fetch(`${BACKEND_API_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });

  if (!response.ok) {
    throw new Error("Google sign-in could not be completed");
  }

  return (await response.json()) as TokenResponse;
}
