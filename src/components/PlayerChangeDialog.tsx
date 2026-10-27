"use client";
import { useEffect, useRef } from 'react';
import { PlayerChangePanel, type PlayerChangePanelProps } from './PlayerChangePanel';

export function PlayerChangeDialog({ onClose, ...props }: PlayerChangePanelProps & { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    // Arbitrary unmount/navigation must not reclaim focus from a newer journey.
    return () => { dialog.close?.(); };
  }, []);

  function closeAndRestoreFocus() {
    // Close before React removes the dialog; native restoration is lost after removal.
    ref.current?.close?.();
    if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
  }

  function closeProposal() {
    closeAndRestoreFocus();
    onClose();
  }

  const accept: PlayerChangePanelProps['onAccept'] = proposal => {
    props.onAccept(proposal);
    // Failed/stale acceptance throws and must leave the proposal journey open.
    closeAndRestoreFocus();
  };

  return <dialog ref={ref} className="player-change-dialog ph-no-capture" data-ph-no-capture="true"
    aria-label="Review a player-directed world change"
    onCancel={event => { event.preventDefault(); closeProposal(); }}>
    <button type="button" className="player-change-close" onClick={closeProposal}>Close proposal</button>
    <PlayerChangePanel {...props} onAccept={accept} />
  </dialog>;
}
