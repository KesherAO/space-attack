const SVG_NS = 'http://www.w3.org/2000/svg';

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function createShipIcon(index) {
  const gradientId = `life-ship-gradient-${index}`;
  const icon = svgElement('svg', {
    class: 'life-ship-icon',
    viewBox: '0 0 100 100',
    role: 'img',
    'aria-label': 'Spare ship life',
  });
  const defs = svgElement('defs');
  const gradient = svgElement('linearGradient', {
    id: gradientId,
    x1: '0', y1: '1', x2: '0.9', y2: '0',
  });
  gradient.append(
    svgElement('stop', { offset: '0%', 'stop-color': '#23879c' }),
    svgElement('stop', { offset: '48%', 'stop-color': '#52d9df' }),
    svgElement('stop', { offset: '100%', 'stop-color': '#b5fbef' }),
  );
  defs.append(gradient);
  icon.append(defs);

  const fill = `url(#${gradientId})`;
  icon.append(
    svgElement('polygon', { points: '38.7,46.5 19.1,39.6 3.1,51.7 13.2,88.8 26.8,92.2 40.5,69.1', fill }),
    svgElement('polygon', { points: '61.3,46.5 80.9,39.6 96.9,51.7 86.8,88.8 73.2,92.2 59.5,69.1', fill }),
    svgElement('polygon', { points: '38.7,89.4 34,74.4 36.3,37.2 42.9,26.2 50,12.9 57.1,26.2 63.7,37.2 66,74.4 61.3,89.4 50,97.5', fill }),
    svgElement('rect', { x: '47.8', y: '3', width: '4.4', height: '22', fill: '#d8fff4', opacity: '0.8' }),
    svgElement('rect', { x: '46.5', y: '3', width: '7', height: '3.5', fill: '#b5fbef', opacity: '0.9' }),
  );
  return icon;
}

export function renderSpareLives(container, count, blinking = false) {
  container.replaceChildren();
  container.setAttribute('aria-label', `${count} spare ${count === 1 ? 'life' : 'lives'}`);

  for (let index = 0; index < count; index += 1) {
    const icon = createShipIcon(index);
    if (blinking && index === count - 1) icon.classList.add('is-spending');
    container.append(icon);
  }
}
