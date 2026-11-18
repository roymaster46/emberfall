// Keyboard and mouse, read once per frame. Keys are tracked by code so WASD and arrows
// both work; the mouse is converted into field coordinates by render's scale.
export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function keydown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    keys.add(event.code);
  }
  function keyup(event) {
    keys.delete(event.code);
  }
  function blur() {
    keys.clear();
    mouse.down = false;
  }
  function mousemove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left - offsetX) / scale;
    mouse.y = (event.clientY - rect.top - offsetY) / scale;
  }
  function mousedown(event) {
    if (event.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  }
  function mouseup(event) {
    if (event.button === 0) mouse.down = false;
  }

  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', blur);
  canvas.addEventListener('mousemove', mousemove);
  canvas.addEventListener('mousedown', mousedown);
  window.addEventListener('mouseup', mouseup);

  return {
    // The renderer's current transform, so mouse pixels become field units.
    setTransform(nextScale, nextOffsetX, nextOffsetY) {
      scale = nextScale;
      offsetX = nextOffsetX;
      offsetY = nextOffsetY;
    },
    axis() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.hypot(x, y);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    firing() {
      return mouse.down || keys.has('Space');
    },
    dashPressed() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    consumeClick() {
      const was = mouse.clicked;
      mouse.clicked = false;
      return was;
    },
    pressed(code) {
      return keys.has(code);
    },
    mouse() {
      return mouse;
    },
  };
}
