// Fallback for <button commandfor command> in browsers without the command API.
if (!('commandForElement' in HTMLButtonElement.prototype)) {
  document.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button[commandfor]') : null;
    const target = button && document.getElementById(button.getAttribute('commandfor'));
    if (!target) return;
    const command = button.getAttribute('command');
    if (command === 'show-modal') target.showModal();
    else if (command === 'close') target.close(button.value);
    else if (command === 'request-close') (target.requestClose ?? target.close).call(target, button.value);
    else if (command === 'toggle-popover') target.togglePopover();
    else if (command === 'show-popover') target.showPopover();
    else if (command === 'hide-popover') target.hidePopover();
  });
}
