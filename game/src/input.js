// Keyboard, mouse and touch input, gathered into one state the world steps with.
// The world only ever sees { left, right, jumpHeld, jumpPressed }: jumpPressed is the
// edge — true for exactly one step after the key goes down — which jump buffering builds on.

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  ArrowDown: 'down', KeyS: 'down',
};

export class Input {
  constructor(canvas) {
    this.held = { left: false, right: false, jump: false, down: false };
    this.pressedEdges = { jump: false, pause: false, confirm: false, mute: false, restart: false };
    this.clicked = false;
    this.anyGesture = false; // the first gesture unlocks WebAudio in the page that hosts us

    window.addEventListener('keydown', (event) => {
      if (event.repeat) {
        if (KEYMAP[event.code]) event.preventDefault();
        return;
      }
      this.anyGesture = true;
      const action = KEYMAP[event.code];
      if (action) {
        if (action === 'jump' && !this.held.jump) this.pressedEdges.jump = true;
        this.held[action] = true;
        event.preventDefault();
      }
      if (event.code === 'KeyP' || event.code === 'Escape') this.pressedEdges.pause = true;
      if (event.code === 'Enter') this.pressedEdges.confirm = true;
      if (event.code === 'KeyM') this.pressedEdges.mute = true;
      if (event.code === 'KeyR') this.pressedEdges.restart = true;
    });
    window.addEventListener('keyup', (event) => {
      const action = KEYMAP[event.code];
      if (action) this.held[action] = false;
    });
    window.addEventListener('blur', () => {
      this.held.left = this.held.right = this.held.jump = this.held.down = false;
    });

    // Mouse: a click confirms menus and can start the game; holding the left or right side
    // of the canvas walks, and a press in the middle jumps — crude, but playable.
    this.pointerAction = null;
    canvas.addEventListener('pointerdown', (event) => {
      this.anyGesture = true;
      this.clicked = true;
      this.pressedEdges.confirm = true;
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      if (x < 0.38) this.pointerAction = 'left';
      else if (x > 0.62) this.pointerAction = 'right';
      else {
        this.pointerAction = 'jump';
        if (!this.held.jump) this.pressedEdges.jump = true;
      }
      canvas.setPointerCapture(event.pointerId);
    });
    const release = () => { this.pointerAction = null; };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
  }

  /** The movement state for one physics step; consumes nothing. */
  moveState() {
    return {
      left: this.held.left || this.pointerAction === 'left',
      right: this.held.right || this.pointerAction === 'right',
      down: this.held.down,
      jumpHeld: this.held.jump || this.pointerAction === 'jump',
    };
  }

  /** Read an edge once: true only on the first read after the press. */
  takeEdge(name) {
    const value = name === 'click' ? this.clicked : this.pressedEdges[name];
    if (name === 'click') this.clicked = false;
    else this.pressedEdges[name] = false;
    return value;
  }

  /** The jump edge, consumed: main calls this once a frame and feeds the buffer. */
  takeJumpPress() {
    const value = this.pressedEdges.jump;
    this.pressedEdges.jump = false;
    return value;
  }
}
