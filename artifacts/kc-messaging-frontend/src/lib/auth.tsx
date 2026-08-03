import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import * as api from "./api";
import { connectSocket, disconnectSocket } from "./socket";

type AuthStatus = "checking" | "signed-out" | "signed-in";

type AuthContextValue = {
  status: AuthStatus;
  user: api.User | null;
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<api.User | null>(null);

  // On mount, if a refresh token is stored, resolve the current user before
  // deciding whether to show the OTP screen or the chat list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!api.hasSession()) {
        if (!cancelled) setStatus("signed-out");
        return;
      }
      try {
        const profile = await api.me();
        if (cancelled) return;
        setUser(profile);
        setStatus("signed-in");
        connectSocket();
      } catch {
        if (!cancelled) setStatus("signed-out");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sendOtp = useCallback(async (phone: string) => {
    await api.sendOtp(phone);
  }, []);

  const verifyOtp = useCallback(async (phone: string, code: string) => {
    await api.verifyOtp(phone, code, "web");
    const profile = await api.me();
    setUser(profile);
    setStatus("signed-in");
    connectSocket();
  }, []);

  const logout = useCallback(async () => {
    disconnectSocket();
    await api.logout();
    setUser(null);
    setStatus("signed-out");
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, sendOtp, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
