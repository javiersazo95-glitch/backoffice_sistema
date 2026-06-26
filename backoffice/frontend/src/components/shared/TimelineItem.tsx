interface TimelineItemProps {
  time: string;
  actor: string;
  text: string;
}

export default function TimelineItem({ time, actor, text }: TimelineItemProps) {
  return (
    <div className="timeline-item">
      <span></span>
      <div>
        <strong>{actor}</strong>
        <small>{time}</small>
        <p>{text}</p>
      </div>
    </div>
  );
}
