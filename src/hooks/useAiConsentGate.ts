import { Alert } from "react-native";
import { useApp } from "../context/AppContext";
import { setAiConsent as persistAiConsent } from "../services/aiConsent";

// RES-188 — gate for AI features when the user hasn't granted third-party-AI
// consent. `aiConsentGranted` lets a screen skip auto-fetched AI content (e.g.
// insight blurbs). `runWithAiConsent` wraps a user-initiated AI action (like
// opening Ester): if consent is granted it runs immediately, otherwise it shows
// a short explanation with an inline option to turn it on, then runs the action.
export function useAiConsentGate() {
  const { state, setAiConsent } = useApp();
  const aiConsentGranted = state.user.aiConsentGranted === true;

  // Persist a grant and mirror it into app state. Returns whether it stuck.
  // Shared by the tap-later Alert flow and the inline AiConsentNudge.
  const grant = async (): Promise<boolean> => {
    try {
      const next = await persistAiConsent("granted");
      const granted = next.consent?.status === "granted";
      setAiConsent(granted, next.needsPrompt);
      return granted;
    } catch {
      return false;
    }
  };

  const runWithAiConsent = (action: () => void) => {
    if (aiConsentGranted) {
      action();
      return;
    }
    Alert.alert(
      "Turn on AI personalization?",
      "Ester and personalized insights use our AI partners (OpenAI, and " +
        "ElevenLabs for voice). Turning this on shares your first name, chats, " +
        "check-in answers, and scan wellness signals to personalize your experience.",
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Turn on",
          onPress: async () => {
            if (await grant()) action();
            else
              Alert.alert(
                "Couldn't update",
                "We couldn't turn that on just now. Please try again.",
              );
          },
        },
      ],
    );
  };

  return { aiConsentGranted, runWithAiConsent, grant };
}
