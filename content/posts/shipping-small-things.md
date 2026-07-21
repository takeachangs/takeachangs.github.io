---
title: Shipping Small Things
description: Why tiny projects teach more than big ones.
date: 2026-03-02
---

Every big thing I've learned came from shipping something small. Not a product — a piece. A toast. A menu. A button that morphs. Small things are honest: there is nowhere for sloppy details to hide, and you can hold the entire problem in your head at once.

## The toast that taught me stacking

A toast component looks trivial from a distance. Then you build one and meet the real questions: what happens when three arrive at once? Do older ones shrink, slide, or fade? Should the stack collapse on hover? Every answer is a design decision wearing an engineering costume.

<demo-toast caption="Press the button a few times to see the stack behave."></demo-toast>

Notice what the stack is doing: each older toast steps back `14px` and scales down slightly, so depth reads at a glance without stealing attention from the newest message.

## Small scope, full quality

The trick is treating a small thing with full seriousness:

- Handle the empty, single, and overflowing cases.
- Make it feel right with the keyboard, not just the pointer.
- Respect `prefers-reduced-motion` from day one.

None of this is glamorous. All of it transfers. When a bigger project shows up, you don't rise to the occasion — you fall back on the habits you built on the small stuff.

Ship the toast. The product can come later.
