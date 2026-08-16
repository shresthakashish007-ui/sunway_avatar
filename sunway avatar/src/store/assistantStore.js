import { create } from "zustand";

// Monotonically-increasing counter — prevents duplicate keys when messages
// are added within the same millisecond (e.g. rapid user + assistant pairs)
let _msgId = Date.now();

export const useAssistantStore = create((set, get) => ({
  // ─── Avatar state ──────────────────────────────────────────────────────
  avatarState: "idle",         // idle | talking | thinking | listening
  currentAnimation: "Idle",
  currentEmotion: "neutral",

  // ─── Chat state ────────────────────────────────────────────────────────
  messages: [],
  isLoading: false,
  isMuted: false,
  isListening: false,
  suggestions: ["BSc Computer Science with AI", "BIT Program", "Fee Structure", "Admissions", "Why Sunway?"],

  // ─── Visual panel state ────────────────────────────────────────────────
  visualAction: { type: "SHOW_HOME", resourceId: "", title: "Welcome" },
  previousVisualAction: null,

  // ─── Session context (for conversation memory) ─────────────────────────
  sessionContext: {},
  conversationHistory: [],

  // ─── Welcome shown flag ────────────────────────────────────────────────
  welcomeShown: false,

  // ─── Actions ──────────────────────────────────────────────────────────
  setAvatarState:     (s) => set({ avatarState: s }),
  setCurrentAnimation:(a) => set({ currentAnimation: a }),
  setCurrentEmotion:  (e) => set({ currentEmotion: e }),
  setIsLoading:       (v) => set({ isLoading: v }),
  setIsListening:     (v) => set({ isListening: v }),
  setIsMuted:         (v) => set({ isMuted: v }),
  setWelcomeShown:    (v) => set({ welcomeShown: v }),

  setVisualAction: (action) => {
    const prev = get().visualAction;
    // Keep current visual if NONE, but allow SHOW_HOME to clear
    if (action.type !== "NONE") {
      set({ visualAction: action, previousVisualAction: prev });
    }
  },

  goBack: () => {
    const prev = get().previousVisualAction;
    // Fall back to home if no previous exists
    const target = prev && prev.type && prev.type !== "NONE"
      ? prev
      : { type: "SHOW_HOME", resourceId: "", title: "" };
    set({ visualAction: target, previousVisualAction: null });
  },

  setSuggestions: (s) => set({ suggestions: s }),

  addMessage: (msg) => set((state) => ({
    messages: [...state.messages, { id: ++_msgId, ...msg }],
  })),

  updateLastAssistantMessage: (patch) => set((state) => {
    const msgs = [...state.messages];
    const lastIdx = msgs.map(m => m.role).lastIndexOf("assistant");
    if (lastIdx !== -1) msgs[lastIdx] = { ...msgs[lastIdx], ...patch };
    return { messages: msgs };
  }),

  addToHistory: (role, content) => set((state) => ({
    conversationHistory: [
      ...state.conversationHistory.slice(-18), // keep last 9 turns
      { role, content },
    ],
  })),

  setSessionContext: (ctx) => set((state) => ({
    sessionContext: { ...state.sessionContext, ...ctx },
  })),

  clearConversation: () => set({
    messages: [],
    conversationHistory: [],
    sessionContext: {},
    visualAction: { type: "SHOW_HOME", resourceId: "", title: "Welcome" },
    suggestions: ["BSc Computer Science with AI", "BIT Program", "Fee Structure", "Admissions"],
  }),
}));
