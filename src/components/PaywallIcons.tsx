import React from "react";
import Svg, {
  Defs,
  FeComposite,
  FeFlood,
  FeGaussianBlur,
  FeMerge,
  FeMergeNode,
  Filter,
  G,
  Path,
} from "react-native-svg";

/**
 * Icons for the rebuilt paywall (Figma 5283:17105).
 *
 * Inlined as paths rather than shipped as .svg files because this repo has no
 * SVG transformer in Metro — every other icon here (BookmarkIcon, TrendIcon)
 * does the same.
 *
 * 🔑 The three value icons carry a WHITE GLOW. It is part of the exported
 * asset, not decoration: Figma bakes it in as a zero-offset drop shadow,
 * #FAFDFE at 60%.
 *
 * 🔴 Built from FeGaussianBlur + FeFlood + FeComposite + FeMerge, NOT
 * FeDropShadow — `FeDropShadow` renders as a no-op here.
 *
 * 🔴 SIGMA IS CALIBRATED, NOT COPIED. Figma's own value is 3.55, but
 * react-native-svg renders a markedly tighter blur for the same number.
 * Measured against Lang's frame, sigma 5 / opacity 0.6 gave ~9pt rising +43
 * where the design has ~12pt rising +41 — a fair match, but Cole asked for a
 * touch more presence on device, so both are nudged up from there. If it ever
 * looks wrong, MEASURE the frame and re-tune rather than assuming the Figma
 * numbers transfer. There is ~17pt of room in the box before it clips.
 *
 * 🔴 A glow needs room, and Android WILL clip it — and the glyph with it.
 * Each icon draws into a box GLOW_SCALE times the glyph, built by padding the
 * glyph's own bounding box symmetrically (not Figma's filter region, which is
 * tight and differs per icon). The caller must size its wrapper to that full
 * box and pull it back with `margin: -size * GLOW_OVERHANG` so the glow
 * overflows without the layout moving. Sizing the wrapper to the glyph instead
 * clipped the second and third icons mid-glyph.
 */

const GLYPH = 32;
const PAD = 17;
const BOX = GLYPH + PAD * 2;
const GLOW_SIGMA = 6.5;
const GLOW_OPACITY = 0.85;

/** Multiply the glyph size by this to get the drawn box. */
export const GLOW_SCALE = BOX / GLYPH;
/** Overhang per side, as a fraction of the glyph size. */
export const GLOW_OVERHANG = (BOX - GLYPH) / GLYPH / 2;

// Back chevron — Figma `arrow_forward`, mirrored.
export function ArrowBackIcon({ size = 24, color = "#FAFDFE" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7.37295 12.7501L12.5422 17.9193C12.6909 18.068 12.7643 18.242 12.7625 18.4413C12.7605 18.6406 12.682 18.8179 12.527 18.9731C12.3718 19.1179 12.1961 19.1929 12 19.1981C11.8038 19.2032 11.6281 19.1282 11.473 18.9731L5.1327 12.6328C5.03904 12.5391 4.97304 12.4404 4.9347 12.3366C4.8962 12.2327 4.87695 12.1206 4.87695 12.0001C4.87695 11.8796 4.8962 11.7674 4.9347 11.6636C4.97304 11.5597 5.03904 11.461 5.1327 11.3673L11.473 5.02705C11.6115 4.88855 11.783 4.81772 11.9875 4.81455C12.192 4.81139 12.3718 4.88222 12.527 5.02705C12.682 5.18222 12.7595 5.36039 12.7595 5.56155C12.7595 5.76289 12.682 5.94114 12.527 6.0963L7.37295 11.2501H18.75C18.9628 11.2501 19.141 11.3219 19.2845 11.4656C19.4281 11.6091 19.5 11.7872 19.5 12.0001C19.5 12.2129 19.4281 12.3911 19.2845 12.5346C19.141 12.6782 18.9628 12.7501 18.75 12.7501H7.37295Z" fill={color} />
    </Svg>
  );
}

// The Reset R monogram — Figma `Brand / Logo / Logo`.
export function ResetMarkIcon({ size = 24, color = "#FAFDFE" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 35.2707 34.8346" fill="none">
      <Path d="M19.6023 0C22.6212 0 25.1917 2.20129 25.664 5.19082L27.7338 18.2882L21.1647 23.2285C24.0357 23.349 26.4439 25.4855 26.8932 28.3551L27.9076 34.8346H14.2431V23.2229H12.622V34.8346H0V0H19.6023ZM20.9358 7.89577C19.2222 7.89577 17.8332 9.31341 17.8332 11.0625C17.8332 12.8115 19.2222 14.2291 20.9358 14.2291C22.6493 14.2291 24.0383 12.8115 24.0383 11.0625C24.0383 9.31341 22.6493 7.89577 20.9358 7.89577ZM32.1682 7.89577C33.8817 7.89577 35.2707 9.31341 35.2707 11.0625C35.2707 12.8112 33.8817 14.2291 32.1682 14.2291C30.4546 14.2291 29.0656 12.8115 29.0656 11.0625C29.0656 9.31341 30.4546 7.89577 32.1682 7.89577Z" fill={color} />
    </Svg>
  );
}

// Figma `person_analysis` — paywall value line 1. Glyph bounding box starts at (4.8967, 4.15133); the
// viewBox pads that symmetrically so the glyph sits dead centre in the box.
export function TypeMeaningIcon({ size = GLYPH, color = "#FAFDFE" }: { size?: number; color?: string }) {
  const box = size * GLOW_SCALE;
  return (
    <Svg width={box} height={box} viewBox={`-12.1033 -12.84867 ${BOX} ${BOX}`} fill="none">
      <Defs>
        <Filter id="person_analysis_glow" filterUnits="userSpaceOnUse" x="-12.1033" y="-12.84867" width={BOX} height={BOX}>
          <FeGaussianBlur in="SourceAlpha" stdDeviation={GLOW_SIGMA} result="blur" />
          <FeFlood floodColor="#FAFDFE" floodOpacity={GLOW_OPACITY} result="tint" />
          <FeComposite in="tint" in2="blur" operator="in" result="glow" />
          <FeMerge>
            <FeMergeNode in="glow" />
            <FeMergeNode in="SourceGraphic" />
          </FeMerge>
        </Filter>
      </Defs>
      <G filter="url(#person_analysis_glow)">
        <Path d="M16.494 11.2973C16.0103 10.8138 15.7684 10.2352 15.7684 9.56167C15.7684 8.88811 16.0103 8.30944 16.494 7.82567C16.9778 7.34189 17.5565 7.1 18.23 7.1C18.9036 7.1 19.4823 7.34189 19.966 7.82567C20.4498 8.30944 20.6917 8.88811 20.6917 9.56167C20.6917 10.2352 20.4498 10.8138 19.966 11.2973C19.4823 11.7811 18.9036 12.023 18.23 12.023C17.5565 12.023 16.9778 11.7811 16.494 11.2973ZM29.4044 27.3257C30.0915 26.6386 30.435 25.8027 30.435 24.818C30.435 23.8333 30.0915 22.9974 29.4044 22.3103C28.7173 21.6232 27.8814 21.2797 26.8967 21.2797C25.912 21.2797 25.0761 21.6232 24.389 22.3103C23.7019 22.9974 23.3584 23.8333 23.3584 24.818C23.3584 25.8027 23.7019 26.6386 24.389 27.3257C25.0761 28.0128 25.912 28.3563 26.8967 28.3563C27.8814 28.3563 28.7173 28.0128 29.4044 27.3257ZM30.0454 29.359C29.5736 29.6872 29.0731 29.9356 28.544 30.104C28.0151 30.2722 27.466 30.3563 26.8967 30.3563C25.3583 30.3563 24.0506 29.8179 22.9737 28.741C21.8968 27.6641 21.3584 26.3564 21.3584 24.818C21.3584 23.2796 21.8968 21.9719 22.9737 20.895C24.0506 19.8181 25.3583 19.2797 26.8967 19.2797C28.4351 19.2797 29.7428 19.8181 30.8197 20.895C31.8966 21.9719 32.435 23.2796 32.435 24.818C32.435 25.3873 32.3509 25.9364 32.1827 26.4653C32.0143 26.9944 31.7659 27.4949 31.4377 27.9667L34.3994 30.9153C34.5838 31.1 34.676 31.3342 34.676 31.618C34.676 31.9018 34.5838 32.136 34.3994 32.3207C34.2147 32.5051 33.9805 32.5973 33.6967 32.5973C33.4129 32.5973 33.1787 32.5051 32.994 32.3207L30.0454 29.359ZM19.6917 29.259C19.9479 29.6812 20.2461 30.0697 20.5864 30.4243C20.9266 30.779 21.2949 31.1042 21.6914 31.4V32.1513C21.6914 32.4351 21.5957 32.6727 21.4044 32.864C21.2128 33.0556 20.9753 33.1513 20.6917 33.1513C20.4079 33.1513 20.1703 33.0556 19.9787 32.864C19.7874 32.6727 19.6917 32.4351 19.6917 32.1513V29.259ZM16.7684 24.9973V32.1513C16.7684 32.4351 16.6727 32.6727 16.4814 32.864C16.2898 33.0556 16.0521 33.1513 15.7684 33.1513C15.4848 33.1513 15.2473 33.0556 15.0557 32.864C14.8644 32.6727 14.7687 32.4351 14.7687 32.1513V15.7667C13.6234 15.6778 12.4913 15.5534 11.3724 15.3937C10.2535 15.2339 9.13259 15.0318 8.0097 14.7873C7.71726 14.7156 7.47792 14.5578 7.2917 14.314C7.10526 14.0704 7.05481 13.8026 7.14037 13.5103C7.22592 13.2266 7.40026 13.0171 7.66337 12.882C7.9267 12.7471 8.20448 12.7156 8.4967 12.7873C10.0934 13.1564 11.7045 13.412 13.33 13.554C14.9556 13.6958 16.5889 13.7667 18.23 13.7667C19.8711 13.7667 21.5045 13.6958 23.13 13.554C24.7556 13.412 26.3667 13.1564 27.9634 12.7873C28.2556 12.7156 28.5334 12.7471 28.7967 12.882C29.0598 13.0171 29.2341 13.2266 29.3197 13.5103C29.4053 13.8026 29.3548 14.0704 29.1684 14.314C28.9821 14.5578 28.7428 14.7156 28.4504 14.7873C27.3275 15.0318 26.2066 15.2339 25.0877 15.3937C23.9688 15.5534 22.8367 15.6778 21.6914 15.7667V18.236C20.7307 18.9624 19.9564 19.877 19.3684 20.9797C18.7804 22.0821 18.4736 23.2847 18.448 24.5873V24.7923C18.448 24.8608 18.4548 24.9291 18.4684 24.9973H16.7684Z" fill={color} />
      </G>
    </Svg>
  );
}

// Figma `eating` — paywall value line 2. Glyph bounding box starts at (1.27933, 4.1); the
// viewBox pads that symmetrically so the glyph sits dead centre in the box.
export function MealsIcon({ size = GLYPH, color = "#FAFDFE" }: { size?: number; color?: string }) {
  const box = size * GLOW_SCALE;
  return (
    <Svg width={box} height={box} viewBox={`-15.72067 -12.9 ${BOX} ${BOX}`} fill="none">
      <Defs>
        <Filter id="eating_glow" filterUnits="userSpaceOnUse" x="-15.72067" y="-12.9" width={BOX} height={BOX}>
          <FeGaussianBlur in="SourceAlpha" stdDeviation={GLOW_SIGMA} result="blur" />
          <FeFlood floodColor="#FAFDFE" floodOpacity={GLOW_OPACITY} result="tint" />
          <FeComposite in="tint" in2="blur" operator="in" result="glow" />
          <FeMerge>
            <FeMergeNode in="glow" />
            <FeMergeNode in="SourceGraphic" />
          </FeMerge>
        </Filter>
      </Defs>
      <G filter="url(#eating_glow)">
        <Path d="M10.946 16.254V8.1C10.946 7.81667 11.0419 7.57922 11.2337 7.38767C11.4254 7.19589 11.663 7.1 11.9463 7.1C12.2299 7.1 12.4673 7.19589 12.6587 7.38767C12.8502 7.57922 12.946 7.81667 12.946 8.1V16.254H14.7923V8.1C14.7923 7.81667 14.8881 7.57922 15.0797 7.38767C15.2714 7.19589 15.5091 7.1 15.7927 7.1C16.076 7.1 16.3134 7.19589 16.505 7.38767C16.6963 7.57922 16.792 7.81667 16.792 8.1V16.254C16.792 17.4471 16.4216 18.474 15.6807 19.3347C14.9396 20.1953 14.028 20.7428 12.946 20.977V32.1C12.946 32.3833 12.8501 32.6208 12.6583 32.8123C12.4666 33.0041 12.229 33.1 11.9457 33.1C11.6621 33.1 11.4247 33.0041 11.2333 32.8123C11.0418 32.6208 10.946 32.3833 10.946 32.1V20.977C9.864 20.7428 8.95244 20.1953 8.21133 19.3347C7.47044 18.474 7.1 17.4471 7.1 16.254V8.1C7.1 7.81667 7.19589 7.57922 7.38767 7.38767C7.57922 7.19589 7.81678 7.1 8.10033 7.1C8.38367 7.1 8.62111 7.19589 8.81267 7.38767C9.004 7.57922 9.09967 7.81667 9.09967 8.1V16.254H10.946ZM23.7663 22.4333H21.3323C20.9877 22.4333 20.7003 22.3179 20.4703 22.087C20.2406 21.8559 20.1257 21.5697 20.1257 21.2283V13.4333C20.1257 11.758 20.6102 10.2837 21.5793 9.01033C22.5484 7.73678 23.533 7.1 24.533 7.1C24.9074 7.1 25.2067 7.23422 25.4307 7.50267C25.6544 7.77089 25.7663 8.10767 25.7663 8.513V32.1C25.7663 32.3833 25.6704 32.6208 25.4787 32.8123C25.2871 33.0041 25.0496 33.1 24.766 33.1C24.4827 33.1 24.2452 33.0041 24.0537 32.8123C23.8621 32.6208 23.7663 32.3833 23.7663 32.1V22.4333Z" fill={color} />
      </G>
    </Svg>
  );
}

// Figma `explore` — paywall value line 3. Glyph bounding box starts at (3.76667, 3.76667); the
// viewBox pads that symmetrically so the glyph sits dead centre in the box.
export function GuidanceIcon({ size = GLYPH, color = "#FAFDFE" }: { size?: number; color?: string }) {
  const box = size * GLOW_SCALE;
  return (
    <Svg width={box} height={box} viewBox={`-13.23333 -13.23333 ${BOX} ${BOX}`} fill="none">
      <Defs>
        <Filter id="explore_glow" filterUnits="userSpaceOnUse" x="-13.23333" y="-13.23333" width={BOX} height={BOX}>
          <FeGaussianBlur in="SourceAlpha" stdDeviation={GLOW_SIGMA} result="blur" />
          <FeFlood floodColor="#FAFDFE" floodOpacity={GLOW_OPACITY} result="tint" />
          <FeComposite in="tint" in2="blur" operator="in" result="glow" />
          <FeMerge>
            <FeMergeNode in="glow" />
            <FeMergeNode in="SourceGraphic" />
          </FeMerge>
        </Filter>
      </Defs>
      <G filter="url(#explore_glow)">
        <Path d="M15.2923 24.9973L21.5 23.1153C21.8931 22.9907 22.2294 22.7886 22.509 22.509C22.7886 22.2294 22.9907 21.8931 23.1153 21.5L25 15.2897C25.0649 15.0641 25.0107 14.8654 24.8373 14.6937C24.664 14.5219 24.4652 14.4693 24.241 14.536L18.0333 16.418C17.6402 16.5427 17.3039 16.7448 17.0243 17.0243C16.7448 17.3039 16.5427 17.6402 16.418 18.0333L14.5333 24.2437C14.4684 24.4692 14.5227 24.6679 14.696 24.8397C14.8693 25.0114 15.0681 25.064 15.2923 24.9973ZM19.7637 21.5103C19.2786 21.5103 18.8672 21.3404 18.5297 21.0007C18.1919 20.6611 18.023 20.2488 18.023 19.7637C18.023 19.2786 18.1929 18.8672 18.5327 18.5297C18.8722 18.1919 19.2846 18.023 19.7697 18.023C20.2548 18.023 20.6661 18.1929 21.0037 18.5327C21.3414 18.8722 21.5103 19.2846 21.5103 19.7697C21.5103 20.2548 21.3404 20.6661 21.0007 21.0037C20.6611 21.3414 20.2488 21.5103 19.7637 21.5103ZM19.769 32.4333C18.017 32.4333 16.3702 32.1009 14.8287 31.436C13.2871 30.7711 11.9462 29.8688 10.806 28.729C9.66578 27.5892 8.763 26.2489 8.09767 24.708C7.43256 23.1671 7.1 21.5208 7.1 19.769C7.1 18.017 7.43244 16.3702 8.09733 14.8287C8.76222 13.2871 9.66456 11.9462 10.8043 10.806C11.9441 9.66578 13.2844 8.763 14.8253 8.09767C16.3662 7.43256 18.0126 7.1 19.7643 7.1C21.5163 7.1 23.1631 7.43244 24.7047 8.09733C26.2462 8.76222 27.5871 9.66456 28.7273 10.8043C29.8676 11.9441 30.7703 13.2844 31.4357 14.8253C32.1008 16.3662 32.4333 18.0126 32.4333 19.7643C32.4333 21.5163 32.1009 23.1631 31.436 24.7047C30.7711 26.2462 29.8688 27.5871 28.729 28.7273C27.5892 29.8676 26.2489 30.7703 24.708 31.4357C23.1671 32.1008 21.5208 32.4333 19.769 32.4333ZM19.7667 30.4333C22.7307 30.4333 25.2494 29.3966 27.323 27.323C29.3966 25.2494 30.4333 22.7307 30.4333 19.7667C30.4333 16.8027 29.3966 14.2839 27.323 12.2103C25.2494 10.1368 22.7307 9.1 19.7667 9.1C16.8027 9.1 14.2839 10.1368 12.2103 12.2103C10.1368 14.2839 9.1 16.8027 9.1 19.7667C9.1 22.7307 10.1368 25.2494 12.2103 27.323C14.2839 29.3966 16.8027 30.4333 19.7667 30.4333Z" fill={color} />
      </G>
    </Svg>
  );
}

// The check glyph inside the consent checkbox — Figma 5266:68045's `check`,
// exported at 16x16. Inlined as a path because Metro has no SVG transformer
// here, same as the icons above.
export function CheckIcon({ size = 16, color = "#FAFDFE" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M6.36667 10.3437L12.1257 4.58467C12.2248 4.48544 12.3408 4.43478 12.4737 4.43267C12.6066 4.43056 12.7247 4.48122 12.8282 4.58467C12.9316 4.68811 12.9833 4.80689 12.9833 4.941C12.9833 5.07522 12.9316 5.19406 12.8282 5.2975L6.7885 11.3475C6.66794 11.4679 6.52733 11.5282 6.36667 11.5282C6.206 11.5282 6.06539 11.4679 5.94483 11.3475L3.1615 8.56417C3.06239 8.46494 3.0135 8.34717 3.01483 8.21083C3.01606 8.07461 3.06839 7.95478 3.17183 7.85133C3.27528 7.74789 3.39406 7.69617 3.52817 7.69617C3.66239 7.69617 3.78122 7.74789 3.88467 7.85133L6.36667 10.3437Z" fill={color} />
    </Svg>
  );
}
