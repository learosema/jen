export function setupCounter(button: Element): void {
  let count = 0;
  const render = (): void => {
    button.textContent = `count is ${count}`;
  };
  button.addEventListener('click', () => {
    count += 1;
    render();
  });
  render();
}
