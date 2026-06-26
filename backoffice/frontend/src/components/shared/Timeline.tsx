import { ReactNode } from 'react';

interface TimelineProps {
  children: ReactNode;
}

export default function Timeline({ children }: TimelineProps) {
  return <div className="timeline">{children}</div>;
}
