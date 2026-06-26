import UiIcon from './UiIcon';
import Badge from './Badge';
import { mediationNoteTypeLabel, mediationNoteTypeTone } from '@/utils/mediationNotes';

interface NoteHistoryItemProps {
  author: string;
  time: string;
  text: string;
  noteType?: string;
  editedAt?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function NoteHistoryItem({ author, time, text, noteType, editedAt, onEdit, onDelete }: NoteHistoryItemProps) {
  const editedSuffix = editedAt ? ` · editada ${editedAt}` : '';
  
  return (
    <article className="note-history-item">
      <div className="note-history-head">
        <div>
          <strong>{author}</strong>
          <small>{time}{editedSuffix}</small>
        </div>
        <div className="note-history-side">
          <Badge text={mediationNoteTypeLabel(noteType)} variant={mediationNoteTypeTone(noteType)} />
          <div className="note-history-actions">
          {onEdit && (
            <button
              className="row-action"
              type="button"
              onClick={onEdit}
              aria-label="Editar nota"
              title="Editar nota"
            >
              <UiIcon name="edit" />
            </button>
          )}
          {onDelete && (
            <button
              className="row-action"
              type="button"
              onClick={onDelete}
              aria-label="Eliminar nota"
              title="Eliminar nota"
            >
              <UiIcon name="trash" />
            </button>
          )}
        </div>
        </div>
      </div>
      <p>{text}</p>
    </article>
  );
}
