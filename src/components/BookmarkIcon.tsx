import React from "react";
import Svg, { Path } from "react-native-svg";

interface BookmarkIconProps {
  // Filled = saved/favorited; outline = not saved.
  filled?: boolean;
  color?: string;
  width?: number;
  height?: number;
  // Adds a light rim around the glyph so it stays legible on top of photos
  // (where a solid-color icon disappears into matching-tone areas).
  halo?: boolean;
}

// Solid bookmark silhouette (saved state).
const FILLED_PATH =
  "M6.5 13.9615L2.53075 15.6652C1.92825 15.9229 1.35583 15.8736 0.8135 15.5173C0.271167 15.1609 0 14.6597 0 14.0135V1.80775C0 1.30258 0.175 0.875 0.525 0.525C0.875 0.175 1.30258 0 1.80775 0H11.1923C11.6974 0 12.125 0.175 12.475 0.525C12.825 0.875 13 1.30258 13 1.80775V14.0135C13 14.6597 12.7288 15.1609 12.1865 15.5173C11.6442 15.8736 11.0718 15.9229 10.4693 15.6652L6.5 13.9615Z";

// Outline bookmark (unsaved state) — a fill-based ring whose geometry lives in
// the y -11.5..4.165 range, so it renders with its own offset viewBox.
const OUTLINE_PATH =
  "M6.5 2.4615L2.53075 4.16525C1.92825 4.42292 1.35583 4.37358 0.8135 4.01725C0.271167 3.66092 0 3.15967 0 2.5135V-9.69225C0 -10.1974 0.175 -10.625 0.525 -10.975C0.875 -11.325 1.30258 -11.5 1.80775 -11.5H11.1923C11.6974 -11.5 12.125 -11.325 12.475 -10.975C12.825 -10.625 13 -10.1974 13 -9.69225V2.5135C13 3.15967 12.7288 3.66092 12.1865 4.01725C11.6442 4.37358 11.0718 4.42292 10.4693 4.16525L6.5 2.4615ZM6.5 0.8L11.0673 2.76725C11.1699 2.81208 11.2677 2.8025 11.3605 2.7385C11.4535 2.67433 11.5 2.58775 11.5 2.47875V-9.69225C11.5 -9.76925 11.4679 -9.83975 11.4038 -9.90375C11.3398 -9.96792 11.2692 -10 11.1923 -10H1.80775C1.73075 -10 1.66025 -9.96792 1.59625 -9.90375C1.53208 -9.83975 1.5 -9.76925 1.5 -9.69225V2.47875C1.5 2.58775 1.5465 2.67433 1.6395 2.7385C1.73233 2.8025 1.83008 2.81208 1.93275 2.76725L6.5 0.8ZM6.5 -10H1.5H11.5H6.5Z";

const HALO_COLOR = "rgba(255,255,255,0.95)";
const HALO_STROKE = 2.4;

export function BookmarkIcon({
  filled = false,
  color = "#361416",
  width = 13,
  height = 16,
  halo = false,
}: BookmarkIconProps) {
  // Pad the viewBox/canvas so the halo rim isn't clipped at the glyph edge.
  const m = halo ? 3 : 0;
  const path = filled ? FILLED_PATH : OUTLINE_PATH;
  // The outline path is authored in an offset coordinate space.
  const vy = filled ? 0 : -11.5;
  const vh = filled ? 16 : 15.66525;

  return (
    <Svg
      width={width + 2 * m}
      height={height + 2 * m}
      viewBox={`${-m} ${vy - m} ${13 + 2 * m} ${vh + 2 * m}`}
      fill="none"
    >
      {halo ? (
        <Path
          d={path}
          fill={filled ? color : "none"}
          stroke={HALO_COLOR}
          strokeWidth={HALO_STROKE}
          strokeLinejoin="round"
        />
      ) : null}
      <Path d={path} fill={color} />
    </Svg>
  );
}
