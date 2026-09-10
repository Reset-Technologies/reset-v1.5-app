import { K } from "../../constants/colors";

// Reset Window surfaces in both app palettes. The Figma hi-fi is the evening
// (maroon) palette; the day values mirror StatDetailSheet's bone sheet so the
// Window reads as part of the same family.
export interface WindowColors {
  text: string;
  textAlt: string;
  card: string;
  border: string;
  ghost: string;
  track: string;
  progress: string;
  sheet: string;
  divider: string;
}

export function windowColors(evening: boolean): WindowColors {
  return evening
    ? {
        text: K.bone,
        textAlt: "#B8A7A8",
        card: "rgba(42,14,16,0.35)",
        border: "#7A565A",
        ghost: "rgba(243,239,227,0.14)",
        track: "rgba(243,239,227,0.22)",
        progress: K.bone,
        sheet: "#2A0E10",
        divider: "#7A565A",
      }
    : {
        text: K.brown,
        textAlt: "#7E6869",
        card: K.bone,
        border: "#C3B9BA",
        ghost: "rgba(54,20,22,0.12)",
        track: "rgba(54,20,22,0.14)",
        progress: K.brown,
        sheet: K.bone,
        divider: "#C3B9BA",
      };
}
