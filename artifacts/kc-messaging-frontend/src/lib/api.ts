import { refreshSocketAuth } from "./socket";

// Matches kc-messaging-backend's endpoint contract exactly — see its README.
// Every request/response shape here mirrors the DTOs and controller returns
// in src/auth/* and src/chat/* of that repo.

const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined;
export const API_URL = (rawApiUrl ?? 'http://localhost:3000').replace(/\/$/, '');

export type User = {
  id: string;
  phone: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type Participant = {
  id: string;
  phone: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  deliveredAt: string | null;
};

export type Conversation = {
  id: string;
  isGroup: boolean;
  title: string | null;
  participants: Participant[];
  lastMessage: Message | null;
  lastReadAt: string | null;
  updatedAt: string;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  deviceId: string;
};

// --- token storage -----------------------------------------------------
// deviceId is generated once per install and reused on every auth call,
// per the backend's Device-keyed refresh token model.

const STORAGE_KEY = "kc.session";

type StoredSession = {
  accessToken: string | null;
  refreshToken: string | null;
  deviceId: string;
};

function loadSession(): StoredSession {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as StoredSession;
      if (parsed.deviceId) return parsed;
    } catch {
      // fall through to a fresh session
    }
  }
  return { accessToken: null, refreshToken: null, deviceId: crypto.randomUUID() };
}

let session = loadSession();

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getDeviceId() {
  return session.deviceId;
}

export function getAccessToken() {
  return session.accessToken;
}

export function setTokens(tokens: TokenPair | null) {
  if (!tokens) {
    session = { accessToken: null, refreshToken: null, deviceId: session.deviceId };
  } else {
    session = { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, deviceId: tokens.deviceId };
  }
  persist();
}

export function hasSession() {
  return Boolean(session.refreshToken);
}

// --- low-level request with single-flight refresh-and-retry ------------
// A 401 from any authed call triggers exactly one /auth/refresh, and every
// request that arrives while that refresh is in flight waits on the same
// promise instead of firing its own, per the backend's rotation contract.

let refreshInFlight: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  if (!session.refreshToken) return false;
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: session.refreshToken, deviceId: session.deviceId }),
  });
  if (!res.ok) {
    setTokens(null);
    return false;
  }
  const tokens = (await res.json()) as TokenPair;
  setTokens(tokens);
  // After refreshing tokens, ensure websocket auth gets the new access token
  try {
    refreshSocketAuth();
  } catch {
    // ignore if sockets are not initialized
  }
  return true;
}

async function refreshOnce(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  opts: { auth?: boolean; retried?: boolean } = {},
): Promise<T> {
  const { auth = true, retried = false } = opts;
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (auth && session.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 401 && auth && !retried) {
    const refreshed = await refreshOnce();
    if (refreshed) {
      return request<T>(path, init, { auth, retried: true });
    }
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.message ?? message;
    } catch {
      // no JSON body
    }
    throw new ApiError(res.status, Array.isArray(message) ? message.join(", ") : message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// --- auth ----------------------------------------------------------------

export function sendOtp(phone: string) {
  return request<{ sent: boolean; expiresInSeconds: number }>(
    "/auth/otp/send",
    { method: "POST", body: JSON.stringify({ phone }) },
    { auth: false },
  );
}

export async function verifyOtp(phone: string, code: string, platform?: string) {
  const tokens = await request<TokenPair>(
    "/auth/otp/verify",
    { method: "POST", body: JSON.stringify({ phone, code, deviceId: session.deviceId, platform }) },
    { auth: false },
  );
  setTokens(tokens);
  return tokens;
}

export async function logout() {
  if (session.accessToken) {
    try {
      await request<{ loggedOut: boolean }>("/auth/logout", { method: "POST" });
    } catch {
      // best-effort — clear local session regardless
    }
  }
  setTokens(null);
}

export function me() {
  return request<User>("/users/me");
}

// --- conversations ---------------------------------------------------------

export function listConversations() {
  return request<Conversation[]>("/conversations");
}

export function createConversation(participantIds: string[], title?: string) {
  return request<Conversation>("/conversations", {
    method: "POST",
    body: JSON.stringify({ participantIds, title }),
  });
}

export function getConversation(id: string) {
  return request<Conversation>(`/conversations/${id}`);
}

export function getMessages(conversationId: string, cursor?: string, limit?: number) {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  return request<Message[]>(`/conversations/${conversationId}/messages${qs ? `?${qs}` : ""}`);
}

export function sendMessage(conversationId: string, body: string) {
  return request<Message>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function markRead(conversationId: string) {
  return request<{ ok: boolean }>(`/conversations/${conversationId}/read`, { method: "POST