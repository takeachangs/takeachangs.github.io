// Newsletter: morph the button label on submit (homepage only)
// ponytail: no backend — wire `fetch` to a real endpoint when one exists
const form = document.querySelector('.newsletter');
const label = form && form.querySelector('button span');

form && form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (label.dataset.busy) return;
  label.dataset.busy = '1';

  label.classList.add('morph-out');

  const swapTo = (text) => {
    label.textContent = text;
    label.classList.remove('morph-out');
    label.classList.add('morph-in');
    void label.offsetHeight; // flush so morph-in registers as the transition start state
    label.classList.remove('morph-in');
  };

  setTimeout(() => {
    swapTo("You're in!");
    form.querySelector('input').value = '';

    setTimeout(() => {
      label.classList.add('morph-out');
      setTimeout(() => {
        swapTo('Subscribe');
        delete label.dataset.busy;
      }, 150);
    }, 2400);
  }, 150);
});
