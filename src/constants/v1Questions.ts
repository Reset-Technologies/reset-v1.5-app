/**
 * Fixed V1 questions — Bryan's handoff workbook, tabs `QUESTIONS` (prompts) and
 * `ANSWER WEIGHTS` (the "Exact tap text" column). Transcribed 2026-10-02.
 *
 * 🔴 Screen Copy row 7 is LOCKED: "Use the V1 Questions tab verbatim." These
 * strings are not ours to edit, reword or sentence-case. The workbook's
 * apostrophes are curly and are kept that way.
 *
 * 🔑 The option `id` is the SCORING KEY, not a display detail. It is what the
 * backend's `v1-typing` engine looks up in ANSWER WEIGHTS, so it must be sent
 * to the API exactly as written — never the index, never the label.
 *
 * 🔑 U3 has SIX options; every other scored question has five. The survey UI
 * must not assume a uniform count.
 *
 * The two non-scoring steps in the sequence (P1 dietary, P2 goal weight) are
 * not here — P1 reuses the existing dietary multi-select, and P2 is its own
 * control. Neither affects the Type; see ROUTING steps 1 and 3.
 */

export type V1QuestionId = "U1" | "U2" | "U3" | "M1" | "M6" | "M11";

export interface V1Option {
  /** ANSWER WEIGHTS row id — sent to the backend verbatim. */
  id: string;
  label: string;
}

export interface V1Question {
  id: V1QuestionId;
  prompt: string;
  options: V1Option[];
}

/** The six SCORED questions, in Bryan's fixed order (ROUTING section B). */
export const V1_QUESTIONS: V1Question[] = [
  {
    id: "U1",
    prompt: "It’s 9pm and dinner was hours ago; what’s usually true?",
    options: [
      { id: "U1_A1", label: "I’m genuinely hungry again" },
      { id: "U1_A2", label: "Something sweet or snacky sounds good" },
      { id: "U1_A3", label: "I’m too wiped to care what I eat" },
      { id: "U1_A4", label: "It depends on the week" },
      { id: "U1_A5", label: "Usually nothing much" },
    ],
  },
  {
    id: "U2",
    prompt: "When a plan usually falls apart, what happened first?",
    options: [
      { id: "U2_A1", label: "I got too hungry" },
      { id: "U2_A2", label: "Life got stressful" },
      { id: "U2_A3", label: "My energy tanked" },
      { id: "U2_A4", label: "Some weeks it’s easy; some weeks it feels impossible" },
      { id: "U2_A5", label: "Nothing dramatic; I just stop following it" },
    ],
  },
  {
    id: "U3",
    prompt: "Think about the last plan that worked at first; what happened next?",
    options: [
      { id: "U3_A1", label: "The weight came back even though I tried to stay on it" },
      { id: "U3_A2", label: "Stress pulled me off" },
      { id: "U3_A3", label: "I felt more drained the longer I did it" },
      { id: "U3_A4", label: "It worked differently depending on the week" },
      { id: "U3_A5", label: "I never really found a rhythm" },
      { id: "U3_A6", label: "It never really worked" },
    ],
  },
  {
    id: "M1",
    prompt: "Which morning sounds most like yours?",
    options: [
      { id: "M1_A1", label: "Coffee buys me hours, then I crash" },
      { id: "M1_A2", label: "I wake tired no matter how long I slept" },
      { id: "M1_A3", label: "I’m ready to eat pretty quickly" },
      { id: "M1_A4", label: "It changes depending on the week" },
      { id: "M1_A5", label: "No strong pattern" },
    ],
  },
  {
    id: "M6",
    prompt: "If tomorrow went sideways, what would you bet caused it?",
    options: [
      { id: "M6_A1", label: "Stress" },
      { id: "M6_A2", label: "Hunger" },
      { id: "M6_A3", label: "Low energy" },
      { id: "M6_A4", label: "A recurring stretch I can usually recognize" },
      { id: "M6_A5", label: "Honestly, no idea" },
    ],
  },
  {
    id: "M11",
    prompt: "When progress stalls, what feels most true?",
    options: [
      { id: "M11_A1", label: "I’m doing the same things and my body stops responding" },
      { id: "M11_A2", label: "Stress is up and my choices follow" },
      { id: "M11_A3", label: "I’m too tired to sustain it" },
      { id: "M11_A4", label: "The stall comes and goes in a recurring rhythm" },
      { id: "M11_A5", label: "I honestly can’t tell why" },
    ],
  },
];

/** Answers keyed by question id — the shape submitted to the typing API. */
export type V1AnswerMap = Partial<Record<V1QuestionId, string>>;

export const V1_QUESTION_BY_ID: Record<V1QuestionId, V1Question> = V1_QUESTIONS.reduce(
  (acc, q) => {
    acc[q.id] = q;
    return acc;
  },
  {} as Record<V1QuestionId, V1Question>,
);

/**
 * Pull the six scored answers out of the free-form `quizAnswers` map.
 *
 * 🔑 Only the six scored ids travel to the typing engine. `quizAnswers` also
 * holds non-scoring entries (the Reset Window question, the goal weight), and
 * ROUTING is explicit that those "never affect scores or diagnostic count".
 */
export function pickV1Answers(
  quizAnswers: Record<string, string | undefined>,
): V1AnswerMap {
  const out: V1AnswerMap = {};
  for (const q of V1_QUESTIONS) {
    const a = quizAnswers[q.id];
    if (a) out[q.id] = a;
  }
  return out;
}
