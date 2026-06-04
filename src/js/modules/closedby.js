const CLOSED_BY_ANY_SELECTOR = 'dialog[closedby="any"]';

function isClosedBySupported() {
  return "HTMLDialogElement" in window && "closedBy" in HTMLDialogElement.prototype;
}

function isOutsideDialog(dialog, event) {
  const rect = dialog.getBoundingClientRect();

  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}

export function initClosedByPolyfill() {
  // Safari fallback for dialog closedby="any" backdrop clicks.
  if (isClosedBySupported()) {
    return;
  }

  document.querySelectorAll(CLOSED_BY_ANY_SELECTOR).forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (isOutsideDialog(dialog, event)) {
        dialog.close();
      }
    });
  });
}
