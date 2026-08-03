import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/;
const CODE_LENGTH = 6;
const RESEND_COOLDOWN_S = 30;

export default function AuthRoute() {
  const { sendOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const boxRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function requestCode(phoneToSend: string) {
    setError(null);
    setBusy(true);
    try {
      await sendOtp(phoneToSend);
      setStep("code");
      setDigits(Array(CODE_LENGTH).fill(""));
      setCooldown(RESEND_COOLDOWN_S);
      setTimeout(() => boxRefs.current[0]?.focus(), 50);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send that code. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function handlePhoneSubmit(e: FormEvent) {
    e.preventDefault();
    if (!PHONE_PATTERN.test(phone)) {
      setError("Enter your number in international format, e.g. +2348012345678");
      return;
    }
    requestCode(phone);
  }

  function handleDigitChange(index: number, value: string) {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      setDigits((d) => d.map((v, i) => (i === index ? "" : v)));
      return;
    }
    const chars = clean.split("");
    setDigits((d) => {
      const next = [...d];
      chars.forEach((c, offset) => {
        if (index + offset < CODE_LENGTH) next[index + offset] = c;
      });
      return next;
    });
    const nextIndex = Math.min(index + chars.length, CODE_LENGTH - 1);
    boxRefs.current[nextIndex]?.focus();
  }

  function handleDigitKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      boxRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length !== CODE_LENGTH) {
      setError("Enter the full code.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await verifyOtp(phone, code);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That code didn't work. Try again.");
      setDigits(Array(CODE_LENGTH).fill(""));
      boxRefs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="wordmark">
          <h1>KC Messaging</h1>
          <div className="woven-strip" />
          <p>
            {step === "phone"
              ? "Sign in with your phone number. We'll text you a code."
              : `Enter the code we sent to ${phone}.`}
          </p>
        </div>

        {error && <div className="form-error">{error}</div>}

        {step === "phone" ? (
          <form onSubmit={handlePhoneSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label className="field-label" htmlFor="phone">
                Phone number
              </label>
              <div className="phone-input-row">
                <input
                  id="phone"
                  className="text-input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+2348012345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.trim())}
                  autoFocus
                />
              </div>
            </div>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label className="field-label">Verification code</label>
              <div className="otp-boxes">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { boxRefs.current[i] = el; }}
                    className="otp-box"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={CODE_LENGTH}
                    value={d}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                  />
                ))}
              </div>
            </div>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? "Verifying…" : "Verify and continue"}
            </button>
            <div className="auth-meta-row">
              <button
                type="button"
                className="ghost-button"
                disabled={cooldown > 0 || busy}
                onClick={() => requestCode(phone)}
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setStep("phone");
                  setError(null);
                }}
              >
                Change number
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
