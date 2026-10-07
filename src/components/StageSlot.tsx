import { useStudio } from '../studio/StudioContext.tsx';

/** Hueco donde cada vista quiere mostrar el canvas del compositor. */
export function StageSlot({ className }: { className?: string }) {
  const { setPortalTarget } = useStudio();
  return (
    <div
      ref={(el) => {
        setPortalTarget(el);
      }}
      className={className ?? 'stage-slot'}
    />
  );
}
