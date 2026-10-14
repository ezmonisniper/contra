/** Browser-side calls to Contra's own API. The browser never talks to third parties directly. */

export type ApiError = { code: string; message: string };

export class ApiFailure extends Error {
  constructor(readonly error: ApiError) {
    super(error.message);
  }
}

export async function api<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method ?? "GET",
      headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiFailure({ code: "network", message: "Couldn't reach Contra. Check your connection." });
  }
  const data = (await res.json().catch(() => null)) as { error?: ApiError } | null;
  if (!res.ok) {
    throw new ApiFailure(data?.error ?? { code: "http_" + res.status, message: "Something went wrong." });
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiFailure) return err.error.message;
  if (err instanceof Error && /reject|denied|cancel/i.test(err.message)) return "You declined in your wallet. Nothing was sent.";
  return "Something went wrong. Nothing was sent.";
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
