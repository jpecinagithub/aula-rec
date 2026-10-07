import { useEffect, useRef } from 'react';

/** Monta un <video> imperativo (de un stream capturado) dentro de un div. */
export function VideoElementView({
  video,
  className,
  label,
}: {
  video: HTMLVideoElement | null;
  className?: string;
  label: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !video) return;
    host.appendChild(video);
    return () => {
      video.remove();
    };
  }, [video]);

  return <div ref={hostRef} className={className} role="img" aria-label={label} />;
}
