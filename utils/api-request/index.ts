import { cookies } from "next/headers";
import { unauthorized } from "next/navigation";
import { config } from "@/config";

type ApiRequestOptions = {
  endpoint: string;
  isProtected?: boolean;
} & RequestInit;

export async function apiRequest(options: ApiRequestOptions) {
  const { endpoint, isProtected = false, ...restOptions } = options;
  const headers: HeadersInit = {};

  if (isProtected) {
    const token = (await cookies()).get("accessToken")?.value;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${config.apiUrl}${endpoint}`, {
    ...restOptions,
    headers,
    cache: "no-store",
  });

  if (res.status === 401) {
    unauthorized();
  }

  return await res.json();
}
