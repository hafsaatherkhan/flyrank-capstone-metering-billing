"use client";

import { useEffect, useRef, useState } from "react";

interface GoogleSignInButtonProps {
  onSuccess: (idToken: string) => void;
  onError: (error: string) => void;
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  disabled?: boolean;
}

export default function GoogleSignInButton({
  onSuccess,
  onError,
  text = "continue_with",
  disabled = false,
}: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const checkGsi = () => {
      if (typeof window !== "undefined" && window.google?.accounts?.id) {
        setScriptLoaded(true);
        return true;
      }
      return false;
    };

    if (!checkGsi()) {
      interval = setInterval(() => {
        if (checkGsi()) {
          clearInterval(interval);
        }
      }, 200);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || !clientId) return;

    try {
      window.google!.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential: string }) => {
          if (response?.credential) {
            onSuccess(response.credential);
          } else {
            onError("No credential received from Google.");
          }
        },
      });

      // Clear previous button render if any
      containerRef.current.innerHTML = "";

      window.google!.accounts.id.renderButton(containerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: text,
        shape: "rectangular",
        logo_alignment: "left",
        width: 380,
      });
    } catch (err: any) {
      console.error("Google button render error:", err);
    }
  }, [scriptLoaded, clientId, text, onSuccess, onError]);

  if (!clientId) {
    return (
      <div className="w-full py-2.5 px-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs text-center">
        NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured
      </div>
    );
  }

  return (
    <div
      className={`w-full flex justify-center items-center my-1 ${
        disabled ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      <div ref={containerRef} className="w-full flex justify-center min-h-[44px]" />
    </div>
  );
}
