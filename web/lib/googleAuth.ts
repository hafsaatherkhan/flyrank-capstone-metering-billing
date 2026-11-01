declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: (momentListener?: (notification: any) => void) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: number;
              locale?: string;
            }
          ) => void;
        };
      };
    };
  }
}

export function promptGoogleLogin({
  clientId,
  onSuccess,
  onError,
}: {
  clientId: string;
  onSuccess: (credential: string) => void;
  onError: (err: string) => void;
}) {
  if (typeof window === "undefined") return;

  if (!window.google?.accounts?.id) {
    onError("Google Identity Services script is loading. Please try again in a moment.");
    return;
  }

  try {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response: { credential: string }) => {
        if (response?.credential) {
          onSuccess(response.credential);
        } else {
          onError("No credential received from Google.");
        }
      },
    });

    window.google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
        const reason = notification.getNotDisplayedReason?.() || notification.getSkippedReason?.();
        console.warn("Google One Tap not displayed/skipped:", reason);
      }
    });
  } catch (err: any) {
    onError(err.message || "Failed to initialize Google login");
  }
}
