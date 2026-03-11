import { useState } from 'react';

// Drop-in replacement for window.confirm
// Usage: const { confirm, ConfirmDialog } = useConfirm()
// await confirm({ title: 'Delete?', message: 'Cannot be undone.' })

export function useConfirm() {
  const [state, setState] = useState(null);

  const confirm = ({ title = 'Are you sure?', message = '', confirmLabel = 'Confirm', danger = true } = {}) => {
    return new Promise((resolve) => {
      setState({ title, message, confirmLabel, danger, resolve });
    });
  };

  const handleClose = (result) => {
    state?.resolve(result);
    setState(null);
  };

  const ConfirmDialog = () => {
    if (!state) return null;
    return (
      <div className="modal-backdrop" style={{ zIndex: 9999 }}>
        <div className="modal-box w-full max-w-sm">
          <div className="modal-header">
            <h2 className="font-serif text-lg text-text">{state.title}</h2>
          </div>
          {state.message && (
            <div className="modal-body">
              <p className="text-sm text-muted">{state.message}</p>
            </div>
          )}
          <div className="modal-footer">
            <button onClick={() => handleClose(false)} className="btn-ghost">Cancel</button>
            <button
              onClick={() => handleClose(true)}
              className={`btn-primary ${state.danger ? 'bg-red-600 hover:bg-red-700 border-red-600' : ''}`}
            >
              {state.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return { confirm, ConfirmDialog };
}
