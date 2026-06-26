import { useState, useEffect, useCallback } from 'react';

interface ToastMessage {
  id: number;
  text: string;
}

let toastQueue: ToastMessage[] = [];
let toastId = 0;
let addToastExternal: ((text: string) => void) | null = null;

export function showToast(text: string) {
  if (addToastExternal) {
    addToastExternal(text);
  } else {
    toastQueue.push({ id: ++toastId, text });
  }
}

export default function Toast() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string) => {
    const id = ++toastId;
    setMessages((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }, 3200);
  }, []);

  useEffect(() => {
    addToastExternal = addToast;
    toastQueue.forEach((m) => addToast(m.text));
    toastQueue = [];
    return () => {
      addToastExternal = null;
    };
  }, [addToast]);

  if (messages.length === 0) return null;

  return (
    <>
      {messages.map((m) => (
        <div key={m.id} className="toast">{m.text}</div>
      ))}
    </>
  );
}
