import type { MouseEvent } from 'react';

let transitionActive = false;

/** Animate only the tapped card. The overlay lives outside the route so it survives navigation. */
export function navigateWithCardExpansion(
  event: MouseEvent<HTMLAnchorElement>,
  navigate: () => void,
  sourceElement?: HTMLElement,
): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  if (transitionActive) {
    event.preventDefault();
    return;
  }

  const card = sourceElement || event.currentTarget.firstElementChild as HTMLElement | null;
  const rect = card?.getBoundingClientRect();
  if (!card || !rect || rect.width < 1 || rect.height < 1 ||
      !card.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  event.preventDefault();
  transitionActive = true;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const style = getComputedStyle(card);
  const backgroundImage = sourceElement && card.firstElementChild
    ? getComputedStyle(card.firstElementChild).backgroundImage
    : style.backgroundImage;
  const backgroundColor = getComputedStyle(document.body).backgroundColor;
  const surface = document.createElement('div');
  surface.setAttribute('aria-hidden', 'true');
  Object.assign(surface.style, {
    position: 'fixed',
    inset: '0',
    width: `${viewportWidth}px`,
    height: `${viewportHeight}px`,
    zIndex: '10000',
    pointerEvents: 'none',
    backgroundColor,
    backgroundImage,
    backgroundSize: 'cover',
    borderRadius: style.borderRadius,
    transformOrigin: 'top left',
    willChange: 'transform, opacity',
  });

  // Keep the card's icon and text visible at the start, then let its tinted surface expand.
  const snapshot = card.cloneNode(true) as HTMLElement;
  snapshot.setAttribute('aria-hidden', 'true');
  Object.assign(snapshot.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
    zIndex: '10001',
    pointerEvents: 'none',
    transform: 'none',
    transition: 'none',
  });
  document.body.append(surface, snapshot);

  const xScale = rect.width / viewportWidth;
  const yScale = rect.height / viewportHeight;
  const expansion = surface.animate([
    { transform: `translate(${rect.left}px, ${rect.top}px) scale(${xScale}, ${yScale})`, borderRadius: style.borderRadius },
    { transform: 'translate(0, 0) scale(1, 1)', borderRadius: '0px' },
  ], { duration: 240, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'forwards' });
  snapshot.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 130, easing: 'ease-out', fill: 'forwards',
  });

  void expansion.finished.then(() => {
    snapshot.remove();
    navigate();

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      observer.disconnect();
      window.clearTimeout(safetyTimeout);
      surface.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 120, easing: 'ease-out', fill: 'forwards',
      }).finished.finally(() => {
        surface.remove();
        transitionActive = false;
      });
    };
    const destinationReady = () =>
      !document.querySelector('[data-dashboard-page]') &&
      !document.querySelector('[data-app-transition-screen]');
    const observer = new MutationObserver(() => {
      if (destinationReady()) requestAnimationFrame(() => requestAnimationFrame(release));
    });
    observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true });
    const safetyTimeout = window.setTimeout(release, 2000);
    if (destinationReady()) requestAnimationFrame(() => requestAnimationFrame(release));
  }).catch(() => {
    snapshot.remove();
    surface.remove();
    transitionActive = false;
    navigate();
  });
}
