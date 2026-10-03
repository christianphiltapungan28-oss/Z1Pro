"use client";

import { useEffect, useState } from "react";

// Set once the intro has played in this tab. The theme script in the root
// layout reads it before first paint and marks <html data-splash="off">, so a
// reload or a later visit to Home doesn't replay it or flash it.
const SPLASH_KEY = "z1p-splash";

/**
 * The Z1P logo animating in over a blank screen the first time Home opens in
 * a tab: the bracket mark swings in, the letters rise one by one, then the
 * whole thing fades away. Tapping skips it. Timings live in globals.css.
 */
export function SplashIntro() {
  const [shown, setShown] = useState(true);

  useEffect(() => {
    // Already played: the CSS keeps it hidden, nothing to record.
    if (document.documentElement.dataset.splash === "off") return;
    try {
      sessionStorage.setItem(SPLASH_KEY, "1");
    } catch {}
  }, []);

  function finish() {
    document.documentElement.dataset.splash = "off";
    setShown(false);
  }

  if (!shown) return null;

  return (
    <div
      aria-hidden="true"
      className="splash-intro fixed inset-0 z-[100] flex items-center justify-center bg-background"
      onClick={finish}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) finish();
      }}
    >
      <div className="splash-glow absolute size-72 rounded-full" />
      {/* /public/ui/logo.svg with the letters split so each can move. */}
      <svg
        className="splash-logo relative h-14 w-auto text-logo sm:h-16"
        viewBox="66.5 14 112 33.5"
        fill="currentColor"
      >
        <path
          className="splash-mark"
          d="M66.5605 47.2432V27.133H73.7428V39.9014H91.1396V22.8237H78.2117V15.3223H98.4815V47.2432H66.5605Z"
        />
        <path
          className="splash-letter"
          d="M124.779 21.9753L111.592 39.8437H124.779V47H101.69V40.2937L114.742 22.3804H101.69V15.269H124.779V21.9753Z"
        />
        <path
          className="splash-letter"
          d="M127.762 47V39.9787H134.874V24.1807C134.484 24.8708 133.914 25.4859 133.163 26.026C132.413 26.5361 131.573 26.9412 130.643 27.2413C129.713 27.5413 128.753 27.7214 127.762 27.7814V19.8599C129.023 19.8599 130.208 19.6348 131.318 19.1848C132.458 18.7047 133.434 18.0445 134.244 17.2044C135.084 16.3342 135.684 15.314 136.044 14.1438H143.245V39.9787H149.997V47H127.762Z"
        />
        <path
          className="splash-letter"
          d="M153.254 47V15.269H166.441C169.082 15.269 171.272 15.7341 173.012 16.6643C174.783 17.5645 176.103 18.8097 176.973 20.4C177.873 21.9903 178.323 23.8056 178.323 25.846C178.323 27.6764 177.888 29.3867 177.018 30.977C176.178 32.5673 174.873 33.8575 173.103 34.8477C171.362 35.8079 169.142 36.288 166.441 36.288H162.075V47H153.254ZM162.075 29.2667H165.586C166.906 29.2667 167.852 28.9516 168.422 28.3215C169.022 27.6914 169.322 26.8662 169.322 25.846C169.322 24.7958 169.022 23.9557 168.422 23.3255C167.852 22.6954 166.906 22.3804 165.586 22.3804H162.075V29.2667Z"
        />
      </svg>
    </div>
  );
}
