interface StepNumberProps {
  number: number;
}

export function StepNumber({ number }: StepNumberProps) {
  return (
    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/20 text-primary text-[11px] font-mono font-bold leading-none select-none">
      {number}
    </div>
  );
}
