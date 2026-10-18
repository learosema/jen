// @ts-check
/**
 * @param {Element} button
 * @returns {void}
 */
export function setupCounter(button) {
  let count = 0;
  const render = () => {
    button.textContent = `count is ${count}`;
  };
  button.addEventListener('click', () => {
    count += 1;
    render();
  });
  render();
}
