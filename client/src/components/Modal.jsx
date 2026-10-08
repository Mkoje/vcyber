import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
export default function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(),
    previous = useRef();
  useEffect(() => {
    previous.current = document.activeElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current.focus();
    function keys(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const items = [
          ...ref.current.querySelectorAll(
            'button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]',
          ),
        ];
        if (!items.length) return;
        const first = items[0],
          last = items.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', keys);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener('keydown', keys);
      previous.current?.focus();
    };
  }, [onClose]);
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={'modal ' + (wide ? 'wide' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
