import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Animated,
  Image,
  Keyboard,
  Linking,
  Easing,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import Markdown from "react-native-markdown-display";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { K, toMetabolicType } from "../../constants/colors";
import { useApp } from "../../context/AppContext";
import { fonts, spacing, radius } from "../../constants/typography";
import { useAppPalette } from "../../hooks/useAppPalette";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  sendMessage as sendChatMessage,
  getSessions,
  getSessionMessages,
  synthesizeSpeech,
} from "../../services/chat";
import type { Meal } from "../../components";
import * as BrazeService from "../../services/braze";

const PENDING_NEW_CHAT_KEY = "@reset_pending_new_chat";
// RES-132: persisted user preference for Ester text-to-speech in chat.
const TTS_ENABLED_KEY = "@reset_ester_tts_enabled";

const ESTER_AVATAR_LIGHT = require("../../../assets/images/ester-avatar.png");
const ESTER_AVATAR_DARK = require("../../../assets/images/ester-avatar-silver.png");

const TYPE_LOGO = {
  Burner: require("../../../assets/images/type-logos/Burner.png"),
  Rebounder: require("../../../assets/images/type-logos/Rebounder.png"),
  Ember: require("../../../assets/images/type-logos/Restorer.png"),
  Chameleon: require("../../../assets/images/type-logos/Chameleon.png"),
  Explorer: require("../../../assets/images/type-logos/Explorer.png"),
};

type ChatRouteParams = {
  EsterChat: {
    context?: "general" | "meal" | "score";
    meal?: Meal;
  };
};

type InputMode = "voice" | "keyboard";

interface ToolCall {
  toolName: string;
  data: Record<string, unknown>;
}

interface Message {
  id: string;
  text: string;
  sender: "user" | "ester";
  timestamp: Date;
  crisisType?: "self_harm" | "eating_disorder";
  toolCalls?: ToolCall[];
}

const SUGGESTED_PROMPTS: Record<"general" | "meal" | "score", string[]> = {
  general: [
    "What signals does the face scan look at?",
    "How do stress and food cravings affect each other?",
    "How can I make healthier choices when I'm busy?",
  ],
  score: [
    "What's driving my score right now?",
    "How does stress change my score?",
    "What can I do today to improve it?",
  ],
  meal: [
    "Why did you pick this for me?",
    "What could I swap in here?",
    "Is this enough protein for me?",
  ],
};

export function EsterChatScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ChatRouteParams, "EsterChat">>();
  const palette = useAppPalette();
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  const context = route.params?.context || "general";
  const meal = route.params?.meal;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | undefined>();
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputMode, setInputMode] = useState<InputMode>("voice");
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const recordStartRef = useRef<number | null>(null);
  const recordTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Speech sessions on iOS sometimes fire "end" events after we've already
  // started a new session — abort() + start() race during second use. We
  // suppress end/error events that arrive within a short window of a fresh
  // start so the new session isn't killed by its predecessor's tail event.
  const startedAtRef = useRef<number>(0);
  const SUPPRESS_END_MS = 600;

  // RES-132 — Ester text-to-speech. Off by default; toggled by the header
  // speaker icon and persisted. A ref mirrors the state so the async
  // send-flow reads the latest value (and can bail if toggled off mid-synth).
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const ttsEnabledRef = useRef(false);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  // While Ester is speaking, reveal her message text in step with playback so
  // the words appear roughly as they're voiced. Only the actively-spoken
  // message is gated; everything else renders its full text.
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const revealTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Refs mirror the reveal state so the async toggle handler can read the live
  // values (and take a timed stream over with voice mid-flight — RES-132).
  const speakingMessageIdRef = useRef<string | null>(null);
  const revealedCountRef = useRef(0);
  const revealStateRef = useRef<{ id: string; text: string } | null>(null);
  const takeoverInFlightRef = useRef(false);
  // True while the mid-stream takeover is synthesizing — drives the loading
  // affordance so the brief freeze doesn't read as a hang.
  const [isPreparingVoice, setIsPreparingVoice] = useState(false);

  const evening = palette.evening;
  const esterAvatar = evening ? ESTER_AVATAR_DARK : ESTER_AVATAR_LIGHT;
  const { state } = useApp();
  const metabolicType =
    toMetabolicType(state.user.metabolicType) ?? "Explorer";
  const headerLogo = TYPE_LOGO[metabolicType];

  // Palette-aware colors (kept inside the component so they react to time-of-day)
  const colors = useMemo(() => {
    if (evening) {
      return {
        screenBg: K.brown,
        textPrimary: K.bone,
        textMuted: "#A8908F",
        userBubbleBg: K.bone,
        userBubbleText: K.brown,
        timestampText: "#A8908F",
        promptChipBg: "rgba(243, 239, 227, 0.15)",
        promptChipText: K.bone,
        typingBubbleBg: "rgba(243, 239, 227, 0.1)",
        typingDot: K.bone,
        ctaBg: K.bone,
        ctaText: K.brown,
        ctaToggleBg: "rgba(243, 239, 227, 0.12)",
        ctaToggleIcon: K.bone,
        inputBg: K.bone,
        inputText: K.brown,
        inputPlaceholder: "#9E9490",
        sendCircleBg: K.brown,
        sendArrowColor: K.white,
        listeningPillBg: "#5A2A2C",
        listeningPillText: K.bone,
        listeningTranscriptMuted: "rgba(243, 239, 227, 0.5)",
        headerIcon: K.bone,
        headerOverlayBg: "rgba(54, 20, 22, 0.92)",
      };
    }
    return {
      screenBg: K.bone,
      textPrimary: K.brown,
      textMuted: "#8B7E7D",
      userBubbleBg: K.white,
      userBubbleText: K.brown,
      timestampText: "#8B7E7D",
      promptChipBg: "#E8E2D8",
      promptChipText: K.brown,
      typingBubbleBg: "#E8E2D8",
      typingDot: K.brown,
      ctaBg: K.brown,
      ctaText: K.bone,
      ctaToggleBg: "rgba(54, 20, 22, 0.12)",
      ctaToggleIcon: K.brown,
      inputBg: K.white,
      inputText: K.brown,
      inputPlaceholder: "#9E9490",
      sendCircleBg: K.brown,
      sendArrowColor: K.white,
      listeningPillBg: "#6E3B30",
      listeningPillText: K.bone,
      listeningTranscriptMuted: "rgba(243, 239, 227, 0.6)",
      headerIcon: K.brown,
      headerOverlayBg: "rgba(243, 239, 227, 0.92)",
    };
  }, [evening]);

  useEffect(() => {
    BrazeService.logEvent("home_ester_chat", { context });
  }, []);

  // Track keyboard height
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Live speech recognition events — drive both transcript preview and stop-on-final
  useSpeechRecognitionEvent("result", (e) => {
    const t = e.results?.[0]?.transcript ?? "";
    if (t) setTranscript(t);
  });
  useSpeechRecognitionEvent("end", () => {
    // Drop tail-end events from the previous session — they'd otherwise
    // immediately kill a freshly started one.
    if (Date.now() - startedAtRef.current < SUPPRESS_END_MS) return;
    if (recordStartRef.current === null) return;
    stopListening();
  });
  useSpeechRecognitionEvent("error", () => {
    if (Date.now() - startedAtRef.current < SUPPRESS_END_MS) return;
    if (recordStartRef.current === null) return;
    stopListening();
  });

  // Whether the en-US on-device speech model is installed: true = use the
  // on-device recognizer (faster + audio stays on the device); false/null =
  // fall back to the network recognizer.
  const [onDeviceVoiceReady, setOnDeviceVoiceReady] = useState<boolean | null>(
    null,
  );

  useEffect(() => {
    (async () => {
      try {
        if (!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
          setOnDeviceVoiceReady(false);
          return;
        }
        const { installedLocales } =
          await ExpoSpeechRecognitionModule.getSupportedLocales(
            Platform.OS === "android"
              ? { androidRecognitionServicePackage: "com.google.android.as" }
              : {},
          );
        setOnDeviceVoiceReady((installedLocales ?? []).includes("en-US"));
      } catch {
        setOnDeviceVoiceReady(false);
      }
    })();
  }, []);

  const defaultGreeting: Message = {
    id: "initial",
    text:
      context === "score"
        ? "Your metabolic score blends a few signals — your scan, your check-ins, and how consistently I've seen them. Ask me which part is driving yours right now."
        : "I've been learning your patterns. Ask me anything.",
    sender: "ester",
    timestamp: new Date(),
  };

  // Load existing session and messages on mount
  useEffect(() => {
    async function loadChatHistory() {
      try {
        const pendingNew = await AsyncStorage.getItem(PENDING_NEW_CHAT_KEY);
        if (!pendingNew) {
          const sessions = await getSessions();
          if (sessions.length > 0) {
            const latestSession = sessions[0];
            setChatSessionId(latestSession.id);

            const history = await getSessionMessages(latestSession.id, 1, 50);
            if (history.data.length > 0) {
              const sorted = [...history.data].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
              );
              const earliestTime = new Date(sorted[0].createdAt);
              const greetingMsg: Message = {
                ...defaultGreeting,
                timestamp: new Date(earliestTime.getTime() - 1000),
              };
              const loaded: Message[] = [
                greetingMsg,
                ...sorted.map((msg) => ({
                  id: msg.id,
                  text: msg.content,
                  sender: msg.role === "user" ? "user" as const : "ester" as const,
                  timestamp: new Date(msg.createdAt),
                  toolCalls: msg.toolCalls as ToolCall[] | undefined,
                })),
              ];
              if (meal) {
                loaded.push({
                  id: `meal-greeting-${Date.now()}`,
                  text: `Let's talk about ${meal.name}. What would you like to know — why I picked it, what you could swap, or something else?`,
                  sender: "ester",
                  timestamp: new Date(),
                });
              }
              setMessages(loaded);
              setIsLoadingHistory(false);
              return;
            }
          }
        }
      } catch {
        // Fall through to default greeting
      }

      const greeting: Message[] = [defaultGreeting];
      if (meal) {
        greeting.push({
          id: `meal-greeting-${Date.now()}`,
          text: `Let's talk about ${meal.name}. What would you like to know — why I picked it, what you could swap, or something else?`,
          sender: "ester",
          timestamp: new Date(),
        });
      }
      setMessages(greeting);
      setIsLoadingHistory(false);
    }

    loadChatHistory();
  }, [meal]);

  const hasUserMessage = messages.some((m) => m.sender === "user");

  const startListening = async () => {
    // Don't let Ester's voice bleed into the mic while the user is talking.
    stopSpeaking();
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) return;

      // Defensive cleanup so iOS's SFSpeechRecognizer can re-arm cleanly when
      // the user taps Tap-to-speak again after submitting.
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // no-op
      }
      startedAtRef.current = Date.now();
      await new Promise((r) => setTimeout(r, 150));

      setTranscript("");
      setRecordSeconds(0);
      recordStartRef.current = Date.now();
      if (recordTickRef.current) clearInterval(recordTickRef.current);
      recordTickRef.current = setInterval(() => {
        if (recordStartRef.current) {
          setRecordSeconds(Math.floor((Date.now() - recordStartRef.current) / 1000));
        }
      }, 250);
      setIsListening(true);
      // On-device only when the en-US model is ALREADY installed: real-time
      // interim results, audio stays on device, and NO download prompt.
      // Otherwise the network recognizer (the "Enable" nudge offers on-device).
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        continuous: true,
        requiresOnDeviceRecognition: onDeviceVoiceReady === true,
        // Without these, Android finalizes after ~450ms of silence and the
        // continuous mode restarts — so before/at the start of speech it churns
        // through empty restarts and drops the first words (a multi-second
        // "delay"). Extend the silence/min-length windows so it waits for
        // speech instead of restarting; the user ends the session via send.
        androidIntentOptions: {
          EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 6000,
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2500,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 2500,
        },
      });
    } catch {
      // Native module unavailable — falls back to keyboard mode silently
      setIsListening(false);
      setInputMode("keyboard");
    }
  };

  const stopListening = () => {
    if (recordTickRef.current) {
      clearInterval(recordTickRef.current);
      recordTickRef.current = null;
    }
    recordStartRef.current = null;
    setIsListening(false);
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // already stopped
    }
  };

  const cancelListening = () => {
    setTranscript("");
    stopListening();
  };

  // RES-132 — load persisted TTS preference, configure audio, release on unmount.
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(TTS_ENABLED_KEY);
        if (saved === "1") {
          setTtsEnabled(true);
          ttsEnabledRef.current = true;
        }
      } catch {}
      try {
        // Let Ester speak even when the ringer is on silent — the user opted in.
        await setAudioModeAsync({ playsInSilentMode: true });
      } catch {}
    })();
    return () => {
      if (revealTickRef.current) clearInterval(revealTickRef.current);
      try {
        audioPlayerRef.current?.remove();
      } catch {}
      audioPlayerRef.current = null;
    };
  }, []);

  // Reveal-state setters that keep the render state and the refs in lockstep.
  const setReveal = (n: number) => {
    revealedCountRef.current = n;
    setRevealedCount(n);
  };
  const setSpeaking = (id: string | null) => {
    speakingMessageIdRef.current = id;
    setSpeakingMessageId(id);
  };
  const clearRevealTick = () => {
    if (revealTickRef.current) {
      clearInterval(revealTickRef.current);
      revealTickRef.current = null;
    }
  };

  // Stop playback and reveal the full text immediately (clearing the gated id
  // makes the row render its complete message). Used on mute / leave / mic.
  const stopSpeaking = () => {
    clearRevealTick();
    revealStateRef.current = null;
    try {
      audioPlayerRef.current?.pause();
    } catch {}
    setSpeaking(null);
  };

  // Reveal `text` in step with the audio player's position. `baseOffset` lets
  // playback cover only the tail [baseOffset → end] — used when voice takes
  // over a text stream already in progress.
  const startRevealTick = (id: string, text: string, baseOffset = 0) => {
    clearRevealTick();
    const span = Math.max(1, text.length - baseOffset);
    revealTickRef.current = setInterval(() => {
      const player = audioPlayerRef.current;
      if (!player) return;
      const dur = player.duration || 0;
      const cur = player.currentTime || 0;
      if (dur <= 0) return; // duration not known yet — wait for load
      setReveal(Math.min(text.length, baseOffset + Math.ceil((span * cur) / dur)));
      if (cur >= dur - 0.06) {
        setReveal(text.length);
        setSpeaking(null);
        revealStateRef.current = null;
        clearRevealTick();
      }
    }, 50);
  };

  // Reveal text on a steady timer when there's no audio to sync to (voice off).
  // ~55 chars/sec reads like a natural typewriter without dragging.
  const startTimedReveal = (id: string, text: string) => {
    clearRevealTick();
    const CHARS_PER_SEC = 55;
    const startedAt = Date.now();
    revealTickRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const count = Math.min(text.length, Math.ceil(CHARS_PER_SEC * elapsed));
      setReveal(count);
      if (count >= text.length) {
        setSpeaking(null);
        revealStateRef.current = null;
        clearRevealTick();
      }
    }, 40);
  };

  // Append an Ester reply and stream its text in. With voice on, synthesize
  // first and sync the reveal to playback; with voice off, stream on a timer.
  // Either way it's best-effort — on failure the full text is shown.
  const presentEsterMessage = async (message: Message) => {
    if (ttsEnabledRef.current && message.text.trim()) {
      try {
        const { audioBase64 } = await synthesizeSpeech(message.text);
        if (ttsEnabledRef.current) {
          const uri = `${FileSystem.cacheDirectory}ester-tts-${Date.now()}.mp3`;
          await FileSystem.writeAsStringAsync(uri, audioBase64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          if (!audioPlayerRef.current) {
            audioPlayerRef.current = createAudioPlayer({ uri });
          } else {
            audioPlayerRef.current.replace({ uri });
          }
          setMessages((prev) => [...prev, message]);
          revealStateRef.current = { id: message.id, text: message.text };
          setSpeaking(message.id);
          setReveal(0);
          audioPlayerRef.current.play();
          startRevealTick(message.id, message.text);
          return;
        }
      } catch {
        // fall through to text-only streaming
      }
    }
    // Voice off (or synthesis failed): stream the text on a timer, no audio.
    setMessages((prev) => [...prev, message]);
    if (message.text.trim()) {
      revealStateRef.current = { id: message.id, text: message.text };
      setSpeaking(message.id);
      setReveal(0);
      startTimedReveal(message.id, message.text);
    }
  };

  // Advance an index forward to the start of the next word so the voice never
  // begins mid-word when it takes over a stream in progress.
  const snapToWordStart = (text: string, idx: number) => {
    let i = Math.min(idx, text.length);
    while (i < text.length && !/\s/.test(text[i])) i++; // finish current word
    while (i < text.length && /\s/.test(text[i])) i++; // skip whitespace
    return i;
  };

  // Option A: when voice is flipped on mid-stream, freeze the text at the
  // current word, synthesize only the remaining tail, then resume with the
  // reveal synced to that audio. ~1s synth gap reads as Ester taking a breath.
  const takeOverWithVoice = async () => {
    const active = revealStateRef.current;
    if (!active || takeoverInFlightRef.current) return;
    const { id, text } = active;
    const offset = snapToWordStart(text, revealedCountRef.current);
    const remainder = text.slice(offset).trim();
    clearRevealTick(); // freeze the timed reveal at the current word
    setReveal(offset);
    if (!remainder) {
      setReveal(text.length);
      setSpeaking(null);
      revealStateRef.current = null;
      return;
    }
    takeoverInFlightRef.current = true;
    setIsPreparingVoice(true);
    try {
      const { audioBase64 } = await synthesizeSpeech(remainder);
      // Bail if the user muted again or moved on during synthesis.
      if (!ttsEnabledRef.current || speakingMessageIdRef.current !== id) return;
      const uri = `${FileSystem.cacheDirectory}ester-tts-${Date.now()}.mp3`;
      await FileSystem.writeAsStringAsync(uri, audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (!audioPlayerRef.current) {
        audioPlayerRef.current = createAudioPlayer({ uri });
      } else {
        audioPlayerRef.current.replace({ uri });
      }
      audioPlayerRef.current.play();
      startRevealTick(id, text, offset);
    } catch {
      // Synthesis failed — just finish revealing the text silently.
      setReveal(text.length);
      setSpeaking(null);
      revealStateRef.current = null;
    } finally {
      takeoverInFlightRef.current = false;
      setIsPreparingVoice(false);
    }
  };

  const toggleTts = async () => {
    const next = !ttsEnabledRef.current;
    setTtsEnabled(next);
    ttsEnabledRef.current = next;
    if (!next) {
      stopSpeaking();
    } else if (revealStateRef.current) {
      // Turned on while a (voice-off) stream is mid-flight → take it over.
      takeOverWithVoice();
    }
    try {
      await AsyncStorage.setItem(TTS_ENABLED_KEY, next ? "1" : "0");
    } catch {}
  };

  const submitVoiceTranscript = async () => {
    const finalText = transcript.trim();
    stopListening();
    if (!finalText) return;
    await sendText(finalText);
    setTranscript("");
  };

  const sendText = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsTyping(true);

    try {
      const isNewMealChat = meal && !chatSessionId;
      const assistantGreeting = isNewMealChat
        ? `Let's talk about ${meal.name}. What would you like to know — why I picked it, what you could swap, or something else?`
        : undefined;

      const response = await sendChatMessage(
        text,
        chatSessionId,
        undefined,
        assistantGreeting,
        meal?.id,
      );

      if (!chatSessionId) {
        setChatSessionId(response.chatSessionId);
        BrazeService.logEvent("chat_started", { context });
        await AsyncStorage.removeItem(PENDING_NEW_CHAT_KEY);
      }

      const esterMessage: Message = {
        id: response.id,
        text: response.content,
        sender: "ester",
        timestamp: new Date(response.createdAt),
        crisisType: response.crisisType,
        toolCalls: response.toolCalls as ToolCall[] | undefined,
      };
      // Stream the reply in — synced to voice when on, on a timer when off.
      await presentEsterMessage(esterMessage);
    } catch {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        text: "Sorry, I couldn't process that. Please try again.",
        sender: "ester",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyboardSend = () => {
    sendText(inputText.trim());
  };

  const handlePromptTap = (prompt: string) => {
    sendText(prompt);
  };

  const toggleInputMode = () => {
    if (isListening) cancelListening();
    setInputMode((m) => (m === "voice" ? "keyboard" : "voice"));
  };

  const handleClose = () => {
    if (isListening) cancelListening();
    stopSpeaking();
    navigation.goBack();
  };

  const handleNewChat = async () => {
    if (isListening) cancelListening();
    stopSpeaking();
    setChatSessionId(undefined);
    setMessages([defaultGreeting]);
    setInputText("");
    await AsyncStorage.setItem(PENDING_NEW_CHAT_KEY, "true");
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  return (
    <View style={[styles.outerContainer, { backgroundColor: colors.screenBg }]}>
      <View
        style={[
          styles.container,
          {
            // +gap on Android: under edge-to-edge the keyboard inset reads a
            // few px short, so the input bar sat flush/barely under the
            // keyboard. The buffer clears it and leaves a small gap. iOS keeps
            // the exact inset (keyboardWillShow reports it accurately).
            paddingBottom:
              keyboardHeight > 0
                ? keyboardHeight + (Platform.OS === "android" ? 12 : 0)
                : insets.bottom,
            backgroundColor: colors.screenBg,
          },
        ]}
      >
        {/* Header: close + new chat | avatar | mute (decorative) */}
        <View
          style={[
            styles.headerOverlay,
            {
              paddingTop: insets.top,
              backgroundColor: colors.headerOverlayBg,
            },
          ]}
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        >
          <View style={styles.header}>
          <View style={styles.headerLeftGroup}>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={handleClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <CloseIcon color={colors.headerIcon} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={handleNewChat}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <PlusIcon color={colors.headerIcon} />
            </TouchableOpacity>
          </View>
          <View style={styles.headerCenter}>
            <Image source={headerLogo} style={styles.headerAvatar} resizeMode="contain" />
          </View>
          <View style={styles.headerRightGroup}>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={toggleTts}
              disabled={isPreparingVoice}
              accessibilityLabel={ttsEnabled ? "Mute Ester's voice" : "Enable Ester's voice"}
              accessibilityState={{ selected: ttsEnabled, busy: isPreparingVoice }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isPreparingVoice ? (
                <ActivityIndicator size="small" color={colors.headerIcon} />
              ) : (
                <MuteIcon color={colors.headerIcon} muted={!ttsEnabled} />
              )}
            </TouchableOpacity>
          </View>
          </View>
        </View>

        {/* Messages */}
        {isLoadingHistory ? (
          <View style={styles.loadingContainer}>
            <Image source={esterAvatar} style={styles.loadingAvatar} resizeMode="contain" />
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={[
              styles.messagesContent,
              { paddingTop: headerHeight + 24 },
            ]}
            onContentSizeChange={() =>
              scrollViewRef.current?.scrollToEnd({ animated: true })
            }
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((message, i) => {
              // Hide the hero greeting once the conversation has started
              if (message.id === "initial" && hasUserMessage) return null;
              if (message.crisisType) {
                return (
                  <CrisisResourceCard
                    key={message.id}
                    message={message}
                    palette={colors}
                  />
                );
              }
              const showTimestamp =
                message.sender === "user" &&
                (i === messages.length - 1 ||
                  messages[i + 1]?.sender !== "user");
              return (
                <React.Fragment key={message.id}>
                  <MessageRow
                    message={message}
                    palette={colors}
                    showTimestamp={showTimestamp}
                    formatTime={formatTime}
                    displayText={
                      message.id === speakingMessageId
                        ? message.text.slice(0, revealedCount)
                        : undefined
                    }
                  />
                  {message.toolCalls?.map((tc, idx) =>
                    tc.toolName === "recommend_meal" && tc.data?.success ? (
                      <InlineMealCard
                        key={`${message.id}-tool-${idx}`}
                        data={tc.data}
                        palette={colors}
                      />
                    ) : null,
                  )}
                </React.Fragment>
              );
            })}

            {/* Suggested prompt chips — shown only when conversation hasn't started */}
            {!hasUserMessage && !isTyping && (
              <View style={styles.promptChipColumn}>
                {SUGGESTED_PROMPTS[context].map((prompt) => (
                  <TouchableOpacity
                    key={prompt}
                    style={[styles.promptChip, { backgroundColor: colors.promptChipBg }]}
                    onPress={() => handlePromptTap(prompt)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.promptChipText,
                        { color: colors.promptChipText },
                      ]}
                    >
                      {prompt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {(isTyping || isPreparingVoice) && (
              <TypingIndicator
                bg={colors.typingBubbleBg}
                dotColor={colors.typingDot}
              />
            )}
          </ScrollView>
        )}

        {/* Bottom input area — voice CTA | listening pill | keyboard input */}
        <View style={styles.bottomBar}>
          {inputMode === "voice" && !isListening && (
            <View style={styles.voiceCtaRow}>
              <TouchableOpacity
                style={[
                  styles.modeToggle,
                  { backgroundColor: colors.ctaToggleBg },
                ]}
                onPress={toggleInputMode}
                activeOpacity={0.8}
              >
                <KeyboardIcon color={colors.ctaToggleIcon} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tapToSpeak, { backgroundColor: colors.ctaBg }]}
                onPress={startListening}
                activeOpacity={0.85}
              >
                <Text style={[styles.tapToSpeakText, { color: colors.ctaText }]}>
                  Tap to speak
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {inputMode === "voice" && isListening && (
            <View
              style={[
                styles.listeningPill,
                { backgroundColor: colors.listeningPillBg },
              ]}
            >
              <View style={styles.listeningTopRow}>
                <View style={styles.listeningWaveformWrap}>
                  <ListeningWaveform color={colors.listeningPillText} active />
                </View>
                <Text style={[styles.listeningDuration, { color: colors.listeningPillText }]}>
                  {formatDuration(recordSeconds)}
                </Text>
                <TouchableOpacity
                  style={[styles.sendCircle, { backgroundColor: colors.sendCircleBg }]}
                  onPress={submitVoiceTranscript}
                  activeOpacity={0.85}
                >
                  <SendArrowIcon color={colors.sendArrowColor} />
                </TouchableOpacity>
              </View>
              <Text
                style={[
                  styles.listeningTranscript,
                  {
                    color: transcript
                      ? colors.listeningPillText
                      : colors.listeningTranscriptMuted,
                  },
                ]}
              >
                {transcript || "Listening…"}
              </Text>
            </View>
          )}

          {inputMode === "keyboard" && (
            <View style={styles.keyboardRow}>
              <TouchableOpacity
                style={[
                  styles.modeToggle,
                  { backgroundColor: colors.ctaToggleBg },
                ]}
                onPress={toggleInputMode}
                activeOpacity={0.8}
              >
                <MicIcon color={colors.ctaToggleIcon} />
              </TouchableOpacity>
              <View style={[styles.inputPill, { backgroundColor: colors.inputBg }]}>
                <TextInput
                  style={[styles.input, { color: colors.inputText }]}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Type anything…"
                  placeholderTextColor={colors.inputPlaceholder}
                  multiline
                  maxLength={500}
                  onSubmitEditing={handleKeyboardSend}
                  returnKeyType="send"
                />
                <TouchableOpacity
                  style={[styles.sendCircleInline, { backgroundColor: colors.sendCircleBg }]}
                  onPress={handleKeyboardSend}
                  disabled={!inputText.trim()}
                  activeOpacity={0.85}
                >
                  <SendArrowIcon color={colors.sendArrowColor} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

interface PaletteColors {
  screenBg: string;
  textPrimary: string;
  textMuted: string;
  userBubbleBg: string;
  userBubbleText: string;
  timestampText: string;
  promptChipBg: string;
  promptChipText: string;
  typingBubbleBg: string;
  typingDot: string;
  ctaBg: string;
  ctaText: string;
  ctaToggleBg: string;
  ctaToggleIcon: string;
  inputBg: string;
  inputText: string;
  inputPlaceholder: string;
  sendCircleBg: string;
  sendArrowColor: string;
  listeningPillBg: string;
  listeningPillText: string;
  listeningTranscriptMuted: string;
  headerIcon: string;
  headerOverlayBg: string;
}

interface MessageRowProps {
  message: Message;
  palette: PaletteColors;
  showTimestamp: boolean;
  formatTime: (d: Date) => string;
  // When set, render this (partially-revealed) text instead of message.text —
  // used to stream an Ester reply in sync with its voice playback (RES-132).
  displayText?: string;
}

function MessageRow({ message, palette, showTimestamp, formatTime, displayText }: MessageRowProps) {
  if (message.sender === "user") {
    return (
      <View style={styles.userRow}>
        <View style={[styles.userBubble, { backgroundColor: palette.userBubbleBg }]}>
          <Text style={[styles.userBubbleText, { color: palette.userBubbleText }]}>
            {message.text}
          </Text>
        </View>
        {showTimestamp && (
          <Text style={[styles.timestamp, { color: palette.timestampText }]}>
            {formatTime(message.timestamp)}
          </Text>
        )}
      </View>
    );
  }
  // Greeting message renders in the hero container per the Figma steady state
  if (message.id === "initial") {
    return (
      <View style={styles.heroGreetingWrap}>
        <Text style={styles.heroGreetingText}>{message.text}</Text>
      </View>
    );
  }
  // Other Ester messages: render markdown (Ester returns ** bold, lists, etc.)
  const mdStyles = {
    body: {
      color: palette.textPrimary,
      fontSize: 16,
      lineHeight: 24,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 8,
      color: palette.textPrimary,
    },
    strong: {
      fontWeight: "600" as const,
      color: palette.textPrimary,
    },
    em: {
      fontStyle: "italic" as const,
      color: palette.textPrimary,
    },
    bullet_list: {
      marginTop: 4,
      marginBottom: 4,
    },
    ordered_list: {
      marginTop: 4,
      marginBottom: 4,
    },
    list_item: {
      marginBottom: 4,
      color: palette.textPrimary,
    },
    bullet_list_icon: {
      color: palette.textPrimary,
    },
    ordered_list_icon: {
      color: palette.textPrimary,
    },
    heading1: {
      color: palette.textPrimary,
      fontSize: 20,
      fontWeight: "600" as const,
      marginTop: 8,
      marginBottom: 4,
    },
    heading2: {
      color: palette.textPrimary,
      fontSize: 18,
      fontWeight: "600" as const,
      marginTop: 8,
      marginBottom: 4,
    },
    heading3: {
      color: palette.textPrimary,
      fontSize: 16,
      fontWeight: "600" as const,
      marginTop: 4,
      marginBottom: 4,
    },
    link: {
      color: palette.textPrimary,
      textDecorationLine: "underline" as const,
    },
    code_inline: {
      backgroundColor: "rgba(0,0,0,0.08)",
      color: palette.textPrimary,
      paddingHorizontal: 4,
      borderRadius: 4,
    },
  };
  return (
    <View style={styles.esterRow}>
      <Markdown style={mdStyles}>{displayText ?? message.text}</Markdown>
    </View>
  );
}

interface CrisisCardProps {
  message: Message;
  palette: PaletteColors;
}

function CrisisResourceCard({ message, palette }: CrisisCardProps) {
  const resources =
    message.crisisType === "self_harm"
      ? [
          { label: "988 Suicide & Crisis Lifeline", action: "tel:988", actionLabel: "Call or text 988" },
          { label: "Crisis Text Line", action: "sms:741741&body=HOME", actionLabel: "Text HOME to 741741" },
        ]
      : [
          {
            label: "National Alliance for Eating Disorders",
            action: "tel:18666621235",
            actionLabel: "Call 1-866-662-1235",
          },
        ];

  return (
    <View style={[styles.crisisCard, { backgroundColor: palette.userBubbleBg, borderColor: K.err }]}>
      <Text style={[styles.crisisText, { color: palette.textPrimary }]}>
        {message.crisisType === "self_harm"
          ? "I hear you, and what you’re feeling matters. Please reach out to someone who can help right now:"
          : "I hear you. This is beyond what I can help with, and I want you to get the right support:"}
      </Text>
      {resources.map((r) => (
        <TouchableOpacity
          key={r.action}
          style={[styles.crisisButton, { backgroundColor: palette.promptChipBg }]}
          onPress={() => Linking.openURL(r.action)}
        >
          <Text style={[styles.crisisButtonLabel, { color: palette.textPrimary }]}>
            {r.label}
          </Text>
          <Text style={[styles.crisisButtonAction, { color: K.blue }]}>{r.actionLabel}</Text>
        </TouchableOpacity>
      ))}
      <Text style={[styles.crisisFooter, { color: palette.textMuted }]}>
        I'm still here for your meals whenever you're ready.
      </Text>
    </View>
  );
}

interface TypingIndicatorProps {
  bg: string;
  dotColor: string;
}

function TypingIndicator({ bg, dotColor }: TypingIndicatorProps) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      ).start();
    };
    animate(dot1, 0);
    animate(dot2, 150);
    animate(dot3, 300);
  }, []);

  return (
    <View style={[styles.typingPill, { backgroundColor: bg }]}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.typingDot,
            {
              backgroundColor: dotColor,
              opacity: dot,
              transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
}

interface InlineMealCardProps {
  data: Record<string, unknown>;
  palette: PaletteColors;
}

function InlineMealCard({ data, palette }: InlineMealCardProps) {
  const navigation = useNavigation();
  const meal = data.meal as Meal | undefined;
  if (!meal) return null;

  const handlePress = () => {
    (navigation as any).navigate("RecipeDetail", { meal });
  };

  return (
    <TouchableOpacity
      style={[styles.inlineMealCard, { backgroundColor: palette.promptChipBg }]}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      <Text style={[styles.inlineMealSlot, { color: K.ochre }]}>
        {(data.slot as string || "").toUpperCase()} ALTERNATIVE
      </Text>
      <Text style={[styles.inlineMealName, { color: palette.textPrimary }]}>{meal.name}</Text>
      {meal.whyLine ? (
        <Text style={[styles.inlineMealWhy, { color: palette.textMuted }]}>{meal.whyLine}</Text>
      ) : null}
      <View style={styles.inlineMealMeta}>
        <Text style={[styles.inlineMealMetaText, { color: palette.textPrimary }]}>
          {meal.calories} cal
        </Text>
        <Text style={[styles.inlineMealMetaDot, { color: palette.textMuted }]}>•</Text>
        <Text style={[styles.inlineMealMetaText, { color: palette.textPrimary }]}>
          {meal.protein}g protein
        </Text>
        <Text style={[styles.inlineMealMetaDot, { color: palette.textMuted }]}>•</Text>
        <Text style={[styles.inlineMealMetaText, { color: palette.textPrimary }]}>
          {meal.prepTime} min
        </Text>
      </View>
      <Text style={[styles.inlineMealTap, { color: K.ochre }]}>Tap for full recipe</Text>
    </TouchableOpacity>
  );
}

// Live animated bars used while listening. Heights animate with random
// rhythm — we don't have access to raw audio levels with on-device STT, so
// this is a stylized indicator of activity rather than a true level meter.
function ListeningWaveform({ color, active }: { color: string; active: boolean }) {
  const bars = useRef(Array.from({ length: 14 }, () => new Animated.Value(0.2))).current;

  useEffect(() => {
    if (!active) return;
    const animations = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, {
            toValue: Math.random() * 0.8 + 0.2,
            duration: 200 + (i % 4) * 60,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(bar, {
            toValue: Math.random() * 0.8 + 0.2,
            duration: 200 + (i % 5) * 50,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [active]);

  return (
    <View style={styles.waveform}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={{
            width: 2,
            marginHorizontal: 1.5,
            backgroundColor: color,
            borderRadius: 1,
            height: bar.interpolate({ inputRange: [0, 1], outputRange: [3, 20] }),
          }}
        />
      ))}
    </View>
  );
}

// Lightweight inline SVG icons so we don't pull in a new icon library.
function CloseIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path
        d="M4 4 L16 16 M16 4 L4 16"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function PlusIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path
        d="M10 3 V17 M3 10 H17"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Speaker glyph. When `muted`, the crossed-out "X" is drawn over it (TTS off);
// otherwise just the speaker (TTS on). Two sub-paths split from the original
// single-path Figma export.
const SPEAKER_PATH =
  "M4.33008 9.59621H1.05437C0.753764 9.59621 0.502833 9.49559 0.301583 9.29434C0.100528 9.09328 0 8.84235 0 8.54155V4.81755C0 4.51674 0.100528 4.26581 0.301583 4.06475C0.502833 3.8635 0.753764 3.76288 1.05437 3.76288H4.33008L7.82104 0.271922C8.10065 -0.0076896 8.42256 -0.0716623 8.78675 0.0800044C9.15094 0.231865 9.33304 0.506713 9.33304 0.904547V12.4545C9.33304 12.8524 9.15094 13.1272 8.78675 13.2791C8.42256 13.4308 8.10065 13.3668 7.82104 13.0872L4.33008 9.59621ZM7.58304 3.00455L5.07471 5.51288H1.74971V7.84621H5.07471L7.58304 10.3545V3.00455Z";
const MUTE_X_PATH =
  "M16.378 7.90892L13.9595 10.3277C13.7979 10.4891 13.5948 10.5717 13.3502 10.5756C13.1058 10.5793 12.899 10.4967 12.7298 10.3277C12.5608 10.1585 12.4763 9.9536 12.4763 9.71288C12.4763 9.47216 12.5608 9.26721 12.7298 9.09805L15.1486 6.67955L12.7298 4.26105C12.5684 4.09946 12.4859 3.89637 12.4822 3.65175C12.4783 3.40734 12.5608 3.20055 12.7298 3.03138C12.899 2.86241 13.1039 2.77792 13.3446 2.77792C13.5855 2.77792 13.7905 2.86241 13.9595 3.03138L16.378 5.45017L18.7965 3.03138C18.958 2.86999 19.1611 2.78735 19.4057 2.78346C19.6504 2.77977 19.8572 2.86241 20.0261 3.03138C20.1951 3.20055 20.2796 3.40549 20.2796 3.64621C20.2796 3.88694 20.1951 4.09188 20.0261 4.26105L17.6073 6.67955L20.0261 9.09805C20.1877 9.25963 20.2703 9.46273 20.274 9.70734C20.2777 9.95175 20.1951 10.1585 20.0261 10.3277C19.8572 10.4967 19.6522 10.5812 19.4113 10.5812C19.1706 10.5812 18.9656 10.4967 18.7965 10.3277L16.378 7.90892Z";

// Two concentric arcs opening rightward from the speaker — the familiar
// "sound on" wave glyph, shown only when TTS is enabled.
const WAVE_INNER_PATH = "M11.4 4.9A2.9 2.9 0 0 1 11.4 9.1";
const WAVE_OUTER_PATH = "M13.4 3.1A5.1 5.1 0 0 1 13.4 10.9";

function MuteIcon({ color, muted = true }: { color: string; muted?: boolean }) {
  return (
    <Svg width={21} height={14} viewBox="0 0 21 14" fill="none">
      <Path d={SPEAKER_PATH} fill={color} />
      {muted ? (
        <Path d={MUTE_X_PATH} fill={color} />
      ) : (
        <>
          <Path
            d={WAVE_INNER_PATH}
            stroke={color}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
          <Path
            d={WAVE_OUTER_PATH}
            stroke={color}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </>
      )}
    </Svg>
  );
}

function KeyboardIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={16} viewBox="0 0 25 18" fill="none">
      <Path
        d="M2.10904 17.5C1.51968 17.5 1.02083 17.2958 0.6125 16.8875C0.204167 16.4792 0 15.9803 0 15.391V2.10904C0 1.51968 0.204167 1.02083 0.6125 0.6125C1.02083 0.204167 1.51968 0 2.10904 0H22.391C22.9803 0 23.4792 0.204167 23.8875 0.6125C24.2958 1.02083 24.5 1.51968 24.5 2.10904V15.391C24.5 15.9803 24.2958 16.4792 23.8875 16.8875C23.4792 17.2958 22.9803 17.5 22.391 17.5H2.10904ZM2.10904 15.75H22.391C22.4958 15.75 22.5818 15.7164 22.6491 15.6491C22.7164 15.5818 22.75 15.4958 22.75 15.391V2.10904C22.75 2.00424 22.7164 1.9182 22.6491 1.85092C22.5818 1.78364 22.4958 1.75 22.391 1.75H2.10904C2.00424 1.75 1.91819 1.78364 1.85092 1.85092C1.78364 1.9182 1.75 2.00424 1.75 2.10904V15.391C1.75 15.4958 1.78364 15.5818 1.85092 15.6491C1.91819 15.7164 2.00424 15.75 2.10904 15.75ZM8.99675 14.2803H15.5032C15.7889 14.2803 16.0323 14.1816 16.2336 13.9843C16.4346 13.7869 16.5352 13.5416 16.5352 13.2484C16.5352 12.9627 16.4346 12.7193 16.2336 12.518C16.0323 12.317 15.7889 12.2165 15.5032 12.2165H8.99675C8.71111 12.2165 8.46767 12.3151 8.26642 12.5125C8.06536 12.7099 7.96483 12.9552 7.96483 13.2484C7.96483 13.534 8.06536 13.7775 8.26642 13.9787C8.46767 14.1798 8.71111 14.2803 8.99675 14.2803ZM6.15971 6.10371C6.36096 5.90246 6.46158 5.65901 6.46158 5.37337C6.46158 5.08774 6.36096 4.84429 6.15971 4.64304C5.95865 4.44199 5.71521 4.34146 5.42937 4.34146C5.14374 4.34146 4.90039 4.44199 4.69933 4.64304C4.49808 4.84429 4.39746 5.08774 4.39746 5.37337C4.39746 5.65901 4.49808 5.90246 4.69933 6.10371C4.90039 6.30496 5.14374 6.40558 5.42937 6.40558C5.71521 6.40558 5.95865 6.30496 6.15971 6.10371ZM10.703 6.10371C10.9043 5.90246 11.0049 5.65901 11.0049 5.37337C11.0049 5.08774 10.9043 4.84429 10.703 4.64304C10.5019 4.44199 10.2585 4.34146 9.97267 4.34146C9.68703 4.34146 9.44368 4.44199 9.24263 4.64304C9.04138 4.84429 8.94075 5.08774 8.94075 5.37337C8.94075 5.65901 9.04138 5.90246 9.24263 6.10371C9.44368 6.30496 9.68703 6.40558 9.97267 6.40558C10.2585 6.40558 10.5019 6.30496 10.703 6.10371ZM15.2574 6.10371C15.4586 5.90246 15.5593 5.65901 15.5593 5.37337C15.5593 5.08774 15.4586 4.84429 15.2574 4.64304C15.0563 4.44199 14.813 4.34146 14.5273 4.34146C14.2415 4.34146 13.9981 4.44199 13.797 4.64304C13.5957 4.84429 13.4951 5.08774 13.4951 5.37337C13.4951 5.65901 13.5957 5.90246 13.797 6.10371C13.9981 6.30496 14.2415 6.40558 14.5273 6.40558C14.813 6.40558 15.0563 6.30496 15.2574 6.10371ZM19.7447 6.15971C19.9459 5.95865 20.0465 5.71521 20.0465 5.42938C20.0465 5.14374 19.9459 4.90039 19.7447 4.69933C19.5434 4.49808 19.3 4.39746 19.0143 4.39746C18.7287 4.39746 18.4853 4.49808 18.284 4.69933C18.0829 4.90039 17.9824 5.14374 17.9824 5.42938C17.9824 5.71521 18.0829 5.95865 18.284 6.15971C18.4853 6.36096 18.7287 6.46158 19.0143 6.46158C19.3 6.46158 19.5434 6.36096 19.7447 6.15971ZM6.15971 10.0412C6.36096 9.83996 6.46158 9.59651 6.46158 9.31087C6.46158 9.02524 6.36096 8.78179 6.15971 8.58054C5.95865 8.37949 5.71521 8.27896 5.42937 8.27896C5.14374 8.27896 4.90039 8.37949 4.69933 8.58054C4.49808 8.78179 4.39746 9.02524 4.39746 9.31087C4.39746 9.59651 4.49808 9.83996 4.69933 10.0412C4.90039 10.2423 5.14374 10.3428 5.42937 10.3428C5.71521 10.3428 5.95865 10.2423 6.15971 10.0412ZM10.703 10.0412C10.9043 9.83996 11.0049 9.59651 11.0049 9.31087C11.0049 9.02524 10.9043 8.78179 10.703 8.58054C10.5019 8.37949 10.2585 8.27896 9.97267 8.27896C9.68703 8.27896 9.44368 8.37949 9.24263 8.58054C9.04138 8.78179 8.94075 9.02524 8.94075 9.31087C8.94075 9.59651 9.04138 9.83996 9.24263 10.0412C9.44368 10.2423 9.68703 10.3428 9.97267 10.3428C10.2585 10.3428 10.5019 10.2423 10.703 10.0412ZM15.2574 10.0412C15.4586 9.83996 15.5593 9.59651 15.5593 9.31087C15.5593 9.02524 15.4586 8.78179 15.2574 8.58054C15.0563 8.37949 14.813 8.27896 14.5273 8.27896C14.2415 8.27896 13.9981 8.37949 13.797 8.58054C13.5957 8.78179 13.4951 9.02524 13.4951 9.31087C13.4951 9.59651 13.5957 9.83996 13.797 10.0412C13.9981 10.2423 14.2415 10.3428 14.5273 10.3428C14.813 10.3428 15.0563 10.2423 15.2574 10.0412ZM19.8007 10.0412C20.0019 9.83996 20.1025 9.59651 20.1025 9.31087C20.1025 9.02524 20.0019 8.78179 19.8007 8.58054C19.5996 8.37949 19.3563 8.27896 19.0706 8.27896C18.7848 8.27896 18.5413 8.37949 18.3403 8.58054C18.139 8.78179 18.0384 9.02524 18.0384 9.31087C18.0384 9.59651 18.139 9.83996 18.3403 10.0412C18.5413 10.2423 18.7848 10.3428 19.0706 10.3428C19.3563 10.3428 19.5996 10.2423 19.8007 10.0412Z"
        fill={color}
      />
    </Svg>
  );
}

function MicIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={23} viewBox="0 0 20 23" fill="none">
      <Path
        d="M4.52083 16.6924V5.47429C4.52083 5.22637 4.60474 5.01861 4.77254 4.851C4.94035 4.68319 5.14821 4.59929 5.39613 4.59929C5.64424 4.59929 5.852 4.68319 6.01942 4.851C6.18703 5.01861 6.27083 5.22637 6.27083 5.47429V16.6924C6.27083 16.9403 6.18693 17.1481 6.01912 17.3157C5.85132 17.4835 5.64346 17.5674 5.39554 17.5674C5.14743 17.5674 4.93967 17.4835 4.77225 17.3157C4.60464 17.1481 4.52083 16.9403 4.52083 16.6924ZM9.04167 21.2917V0.875C9.04167 0.627083 9.12557 0.41932 9.29338 0.251708C9.46118 0.0839029 9.66904 0 9.91696 0C10.1651 0 10.3728 0.0839029 10.5403 0.251708C10.7079 0.41932 10.7917 0.627083 10.7917 0.875V21.2917C10.7917 21.5396 10.7078 21.7473 10.54 21.915C10.3722 22.0828 10.1643 22.1667 9.91637 22.1667C9.66826 22.1667 9.4605 22.0828 9.29308 21.915C9.12547 21.7473 9.04167 21.5396 9.04167 21.2917ZM0 12.1377V10.029C0 9.78104 0.0839029 9.57318 0.251708 9.40537C0.419514 9.23776 0.627375 9.15396 0.875292 9.15396C1.1234 9.15396 1.33117 9.23776 1.49858 9.40537C1.66619 9.57318 1.75 9.78104 1.75 10.029V12.1377C1.75 12.3856 1.6661 12.5935 1.49829 12.7613C1.33049 12.9289 1.12263 13.0127 0.874708 13.0127C0.626597 13.0127 0.418833 12.9289 0.251417 12.7613C0.0838054 12.5935 0 12.3856 0 12.1377ZM13.5625 16.6924V5.47429C13.5625 5.22637 13.6464 5.01861 13.8142 4.851C13.982 4.68319 14.1899 4.59929 14.4378 4.59929C14.6859 4.59929 14.8937 4.68319 15.0611 4.851C15.2287 5.01861 15.3125 5.22637 15.3125 5.47429V16.6924C15.3125 16.9403 15.2286 17.1481 15.0608 17.3157C14.893 17.4835 14.6851 17.5674 14.4372 17.5674C14.1891 17.5674 13.9813 17.4835 13.8139 17.3157C13.6463 17.1481 13.5625 16.9403 13.5625 16.6924ZM18.0833 12.1377V10.029C18.0833 9.78104 18.1672 9.57318 18.335 9.40537C18.5028 9.23776 18.7107 9.15396 18.9586 9.15396C19.2067 9.15396 19.4145 9.23776 19.5819 9.40537C19.7495 9.57318 19.8333 9.78104 19.8333 10.029V12.1377C19.8333 12.3856 19.7494 12.5935 19.5816 12.7613C19.4138 12.9289 19.206 13.0127 18.958 13.0127C18.7099 13.0127 18.5022 12.9289 18.3347 12.7613C18.1671 12.5935 18.0833 12.3856 18.0833 12.1377Z"
        fill={color}
      />
    </Svg>
  );
}

function SendArrowIcon({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 15 15" fill="none">
      <Path
        d="M6.44825 2.496L1.279 7.66525C1.13033 7.81392 0.956333 7.88733 0.757 7.8855C0.557666 7.8835 0.380416 7.805 0.22525 7.65C0.0804164 7.49483 0.00541641 7.31917 0.00024974 7.123C-0.00491693 6.92683 0.0700831 6.75117 0.22525 6.596L6.5655 0.25575C6.65917 0.162083 6.75792 0.0960833 6.86175 0.0577499C6.96558 0.0192499 7.07775 0 7.19825 0C7.31875 0 7.43092 0.0192499 7.53475 0.0577499C7.63858 0.0960833 7.73733 0.162083 7.831 0.25575L14.1712 6.596C14.3097 6.7345 14.3806 6.906 14.3837 7.1105C14.3869 7.315 14.3161 7.49483 14.1712 7.65C14.0161 7.805 13.8379 7.8825 13.6367 7.8825C13.4354 7.8825 13.2572 7.805 13.102 7.65L7.94825 2.496V13.873C7.94825 14.0858 7.87642 14.264 7.73275 14.4075C7.58925 14.5512 7.41108 14.623 7.19825 14.623C6.98542 14.623 6.80725 14.5512 6.66375 14.4075C6.52008 14.264 6.44825 14.0858 6.44825 13.873V2.496Z"
        fill={color}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  headerLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    width: 76,
  },
  headerRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    width: 76,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  headerAvatar: {
    width: 53,
    height: 53,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingAvatar: {
    width: 140,
    height: 140,
    opacity: 0.9,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 24,
    alignItems: "center",
  },
  esterRow: {
    width: "100%",
  },
  esterText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
  },
  heroGreetingWrap: {
    alignSelf: "stretch",
    height: 223.5,
    justifyContent: "center",
  },
  heroGreetingText: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    fontWeight: "400",
    letterSpacing: -0.16,
    color: "#7E6869",
  },
  userRow: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
    gap: 4,
    maxWidth: "82%",
  },
  userBubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 22,
  },
  userBubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 11,
    marginRight: 4,
  },
  promptChipColumn: {
    alignSelf: "stretch",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  promptChip: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 12,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 999,
    maxWidth: "82%",
  },
  promptChipText: {
    fontSize: 15,
    lineHeight: 20,
  },
  typingPill: {
    flexDirection: "row",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
    gap: 5,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  voiceCtaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  modeToggle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  tapToSpeak: {
    flex: 1,
    minWidth: 120,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  tapToSpeakText: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    fontWeight: "400",
    letterSpacing: -0.2,
    textAlign: "center",
  },
  listeningPill: {
    borderRadius: 28,
    paddingTop: 8,
    paddingBottom: 14,
    paddingHorizontal: 12,
    gap: 6,
    maxHeight: 220,
  },
  listeningTopRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    gap: 8,
  },
  listeningWaveformWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  listeningTranscript: {
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  listeningDuration: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    marginRight: 4,
  },
  waveform: {
    flexDirection: "row",
    alignItems: "center",
    height: 24,
  },
  sendCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  keyboardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  inputPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingLeft: 24,
    paddingRight: 8,
    paddingVertical: 8,
    minHeight: 56,
    maxHeight: 140,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    padding: 0,
  },
  sendCircleInline: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  crisisCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  crisisText: {
    fontSize: 15,
    lineHeight: 22,
  },
  crisisButton: {
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  crisisButtonLabel: {
    fontWeight: "600",
    fontSize: 14,
  },
  crisisButtonAction: {
    fontSize: 12,
    marginTop: 2,
  },
  crisisFooter: {
    fontSize: 12,
    marginTop: spacing.sm,
  },
  inlineMealCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    alignSelf: "stretch",
  },
  inlineMealSlot: {
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "600",
    marginBottom: 4,
  },
  inlineMealName: {
    fontWeight: "600",
    fontSize: 15,
    marginBottom: 4,
  },
  inlineMealWhy: {
    fontSize: 13,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  inlineMealMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  inlineMealMetaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  inlineMealMetaDot: {
    fontSize: 10,
  },
  inlineMealTap: {
    fontSize: 11,
    fontWeight: "500",
  },
});
