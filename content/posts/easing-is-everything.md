---
title: Easing Is Everything
description: How timing curves change the way motion feels.
date: 2026-04-12
---

Two animations with the same duration can feel completely different. Duration decides how long something takes; the easing curve decides what it *feels* like on the way. Most motion that reads as "cheap" isn't too slow or too fast — it's linear.

Nothing in the physical world moves linearly. Things accelerate, coast, and settle. When an element glides at constant speed, our eyes flag it as synthetic immediately.

## Start with ease-out

For elements entering the screen, you almost always want an `ease-out` curve — fast at the start, settling at the end. The interface responds instantly, then calms down:

```css
.menu {
  transform-origin: top;
  transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 180ms ease-out;
}

.menu[data-closed] {
  transform: scaleY(0.95);
  opacity: 0;
}
```

The curve `cubic-bezier(0.16, 1, 0.3, 1)` overshoots nothing but decelerates hard, which makes a `180ms` animation feel even faster than it is.

## State changes want symmetry broken

A common mistake is using one curve everywhere. Enter and exit have different jobs: an entrance should announce itself, an exit should disappear before you think about it. In practice that means exits get shorter durations and simpler curves:

```js
function toggle(menu, open) {
  menu.style.transition = open
    ? "transform 180ms cubic-bezier(0.16, 1, 0.3, 1)"
    : "transform 120ms ease-in";
  menu.dataset.state = open ? "open" : "closed";
}
```

## Feel it, don't read it

Curves are impossible to evaluate in a table of numbers. Put the interaction in your hand and press it a few dozen times — a morphing control makes the character of a curve obvious in a way no cheatsheet can.

<demo-morph caption="Press the button to feel a spring-flavored curve."></demo-morph>

When a transition finally feels right, write the values down. A small set of named curves you actually trust beats a folder of bookmarked easing galleries.
