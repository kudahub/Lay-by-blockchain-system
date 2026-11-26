import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { AuthError, SubmitButton } from "@/components/auth/parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// The step an unverified account lands on from the login page: it sends a fresh
// 6-digit code, verifies it, and finishes the sign-in the password started.
export default function VerifyEmailStep({ email, returnTo, onMfa, onBack }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  async function sendCode() {
    setResending(true);
    setError("");
    try {
      await base44.auth.resendOtp(email);
      setNotice("A fresh code was sent. It expires in 10 minutes.");
    } catch (err) {
      setError(err.message || "We could not send the code. Try again in a moment.");
    } finally {
      setResending(false);
    }
  }

  // A code from an earlier sign-up has usually expired by now, so send a new one.
  useEffect(() => {
    sendCode();
  }, []);

  async function verify(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode: code.trim() });
      if (result?.mfa_required) {
        onMfa(result);
        return;
      }
      if (result?.access_token) base44.auth.setToken(result.access_token);
      // A hard redirect: the app re-initializes with the new session.
      window.location.href = returnTo;
    } catch (err) {
      setError(err.message || "That code is not correct. Check the email and try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <AuthError>{error}</AuthError>
      {notice ? (
        <p className="mb-4 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">{notice}</p>
      ) : null}
      <form onSubmit={verify} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="verify-code">6-digit code</Label>
          <Input
            id="verify-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="h-12 text-center font-mono text-lg tracking-[0.4em]"
            autoFocus
            required
          />
        </div>
        <SubmitButton busy={busy} busyLabel="Verifying...">
          Verify and sign in
        </SubmitButton>
      </form>
      <div className="mt-6 flex flex-col items-center gap-1 text-sm">
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-primary"
          onClick={sendCode}
          disabled={resending}
        >
          {resending ? "Sending a new code..." : "Send a new code"}
        </Button>
        <Button type="button" variant="link" className="h-auto p-0 text-muted-foreground" onClick={onBack}>
          Use a different email
        </Button>
      </div>
    </>
  );
}
