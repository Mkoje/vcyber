import { useCallback } from 'react';
import { LockKeyhole } from 'lucide-react';
import Modal from './Modal';
import { money } from '../api';
export default function PreviewModal({ order, onClose, onCheckout }) {
  const close = useCallback(onClose, [onClose]);
  return (
    <Modal title="Review your document" onClose={close} wide>
      <div className="preview-toolbar">
        <span>
          {order.pages} PDF page{order.pages === 1 ? '' : 's'} ·{' '}
          {order.kind === 'cbc' ? 'Fixed assignment price' : `${money(order.unitPrice)} / page`}
        </span>
        <strong>{money(order.amount)}</strong>
      </div>
      <div
        className="preview-area"
        onContextMenu={(e) => e.preventDefault()}
        onCopy={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        {Array.from({ length: order.previewCount }, (_, i) => (
          <img
            key={i}
            src={`/api/preview/${order.id}/${i + 1}`}
            alt={`Watermarked document preview, page ${i + 1}`}
            draggable="false"
          />
        ))}
      </div>
      <div className="preview-bottom">
        <p>
          <LockKeyhole size={16} /> Pay to download the clean PDF or editable DOCX.
        </p>
        <button className="button primary" onClick={() => onCheckout(order)}>
          Continue · {money(order.amount)}
        </button>
      </div>
      <p className="fineprint">
        Review all details before paying. PDF pages determine the price; editable Word documents may
        paginate differently.
      </p>
    </Modal>
  );
}
