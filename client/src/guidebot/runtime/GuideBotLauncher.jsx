import React from 'react';
import { Compass } from 'lucide-react';
import guideBotRuntime from './GuideBotRuntime';

/**
 * Accessible button that starts the given portal's registered GuideBot
 * tour via the existing runtime singleton. Intentionally dumb: click ->
 * guideBotRuntime.start(tourId). No state, no context, no second runtime
 * instance, no auto-start. Styled with the app's own Tailwind `primary`
 * token (#2563EB, tailwind.config.js) as a single restrained brand color
 * rather than a loud multi-hue gradient, so it reads as a native, premium
 * part of the product rather than a bolted-on widget.
 *
 * @param {{ tourId: string }} props - tourId is required.
 */
const GuideBotLauncher = ({ tourId }) => {
  const handleClick = () => {
    guideBotRuntime.start(tourId);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Start GuideBot walkthrough"
      className="inline-flex items-center gap-2 h-11 pl-3.5 pr-4 rounded-full text-[13px] font-semibold text-white bg-[#2563EB] shadow-[0_4px_14px_rgba(37,99,235,0.35)] ring-1 ring-white/10 hover:bg-[#1D4ED8] hover:shadow-[0_8px_20px_rgba(37,99,235,0.45)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_2px_8px_rgba(37,99,235,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2563EB] transition-all duration-200"
    >
      <Compass size={17} strokeWidth={2.25} className="shrink-0" />
      GuideBot
    </button>
  );
};

export default GuideBotLauncher;
