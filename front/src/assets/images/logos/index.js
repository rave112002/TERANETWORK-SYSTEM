import teraWordmarkWhite from "./tera-wordmark-white.webp";
import teraWordmarkDark from "./tera-wordmark-dark.webp";
import teraMarkWhite from "./tera-mark-white.webp";
import teraMarkDark from "./tera-mark-dark.webp";

/**
 * TERANETWORK brand marks.
 *
 * Two colourways of each because the app has a dark theme: the "white" ones are
 * for dark surfaces (the login photo panel, a dark sidebar), the "dark" ones for
 * light surfaces. Pick with the `dark:` variant rather than filtering a single
 * asset — a CSS invert on a coloured logo does not survive contact with brand
 * guidelines.
 *
 * Re-encoded from the originals as WebP: the source PNGs were 5MB together.
 */
export { teraWordmarkWhite, teraWordmarkDark, teraMarkWhite, teraMarkDark };

// Kept so existing imports of `logo` keep working.
export const logo = teraMarkDark;

//black logos
import teraNetworkBlack from "../logos/black/tera-network-logo-black.png";
import teraBlack from "../logos/black/tera-logo-black.png";

//white logos
import teraNetworkWhite from "../logos/white/tera-network-logo-white.png";
import teraWhite from "../logos/white/tera-logo-white.png";
import teraLogoWhite from "../logos/white/teranetwork-white.png";

export {
  teraNetworkBlack,
  teraBlack,
  teraNetworkWhite,
  teraWhite,
  teraLogoWhite,
};
