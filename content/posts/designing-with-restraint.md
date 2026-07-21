---
title: Designing With Restraint
description: Why less motion often feels like more.
date: 2026-06-20
---

Motion is the easiest tool to overuse. A little of it makes an interface feel alive; too much of it makes every click feel like waiting. The difference between the two is rarely the animation itself — it's whether the animation has a job.

Before adding one, I try to answer a single question: *what* does this movement explain? If the answer is "nothing, it just looks nice", that is sometimes fine. But it should be a deliberate choice, not a default.

## Give motion a job

Good animation carries information. It can show where something came from, where it went, or that the interface heard you. When a hover state eases instead of snapping, the button feels calmer under the cursor — the change reads as a surface reacting, not a pixel flipping.

<demo-transition caption="Hover over the buttons. The left one snaps, the right one eases."></demo-transition>

The effect is subtle, and that's the point. You would never call the eased button "animated". You would just say it feels better, without being able to name why.

## Respect frequency

How often an interaction happens should set how much motion it gets:

- A dialog you see once a day can afford a soft entrance.
- A menu you open hundreds of times should get out of your way.
- Anything on a keyboard path should feel instant.

The same dropdown at two speeds makes the trade-off obvious. The slower one is more *dramatic*, but drama is exactly what you don't want on the hundredth open.

<demo-speed caption="Click the buttons to compare. 180ms on the left, 400ms on the right."></demo-speed>

Past `300ms`, a UI animation stops feeling responsive and starts feeling like a decision you made on the user's behalf.

## Restraint is a feature

Removing an animation is a design decision with the same weight as adding one. The interfaces I admire most animate rarely — and because they animate rarely, the moments they do move actually mean something.

Less motion, chosen carefully, reads as confidence.

[See everything I've written →](/blog/)
