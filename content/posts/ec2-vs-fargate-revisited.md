---
title: EC2 vs Fargate, Revisited
description: Agent workloads change an old default.
date: 2026-07-21
---

Ask whether to run ECS on EC2 or Fargate for a small, variable workload — a blog post, a comparison table, even Claude Code — and the answer comes back Fargate.

Hosts are work. Someone sizes the fleet, tunes the scaling, patches the AMI, drains instances, and is there when capacity runs out. Paying AWS to make all of that disappear was usually the honest choice.

Then agent workloads changed the math on me. A session can stay warm for hours while doing very little, and Fargate bills for the CPU and memory reserved for it the entire time. On EC2, those sessions can share a host and borrow the same spare headroom. The old answer still removes the old work. The question is whether that work still costs what it used to.

## The premium was never compute

Fargate and EC2 charge for different things.

With Fargate, the unit is a task. You choose its CPU and memory, and [AWS bills those resources while the task runs](https://aws.amazon.com/fargate/pricing/); each task gets its own isolated slice of infrastructure. It's clean, predictable, and hard to use efficiently when a task spends most of its life waiting.

With EC2, the unit is the host. You pay for the instance whether it holds one task or twenty. A badly packed instance is expensive empty space; a well-packed one lets many tasks share the same headroom:

<figure class="bill2-chart" style="margin:32px 0;">
<svg viewBox="0 0 692 492" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:auto;" role="img" aria-labelledby="bill2-chart-title-a bill2-chart-desc-a">
<title id="bill2-chart-title-a">What each model bills</title>
<desc id="bill2-chart-desc-a">Two-panel bar chart. On Fargate, each of six tasks is billed as its own reservation, drawn as an outline envelope of identical height; the actual-use bar inside varies per task, and the gap between use and reservation is idle capacity that is billed and trapped per task. On EC2, one wide outline envelope represents the single billed host; the same six use bars at the same heights sit inside it, sharing one pool of headroom instead of six separate trapped pockets.</desc>
<defs>
<pattern id="bill2-hatch-a" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
<line x1="0" y1="0" x2="0" y2="5" stroke="var(--label)" stroke-width="1.2"/>
</pattern>
</defs>
<style>
.bill2-baseline{stroke:var(--gray-600);stroke-width:2}
.bill2-bar-solid{fill:var(--label)}
.bill2-bar-hatch{fill:url(#bill2-hatch-a)}
.bill2-bar-outline{fill:none;stroke:var(--label);stroke-width:1.5}
.bill2-panel-label{font-size:12.5px;fill:var(--gray-1100)}
.bill2-annotation{font-family:Mono,ui-monospace,monospace;font-size:11px;fill:var(--gray-1000);text-anchor:middle}
.bill2-legend-text{font-size:11.5px;fill:var(--gray-1000)}
</style>
<text class="bill2-panel-label" x="46" y="28">Fargate &mdash; the task is the billing unit</text>
<line class="bill2-baseline" x1="46" y1="168" x2="646" y2="168"/>
<rect class="bill2-bar-solid" x="78" y="132" width="36" height="36"/>
<path class="bill2-bar-hatch" d="M78 132 V52 A4 4 0 0 1 82 48 H110 A4 4 0 0 1 114 52 V132 Z"/>
<path class="bill2-bar-outline" d="M78 168 V52 A4 4 0 0 1 82 48 H110 A4 4 0 0 1 114 52 V168 Z"/>
<rect class="bill2-bar-solid" x="178" y="102" width="36" height="66"/>
<path class="bill2-bar-hatch" d="M178 102 V52 A4 4 0 0 1 182 48 H210 A4 4 0 0 1 214 52 V102 Z"/>
<path class="bill2-bar-outline" d="M178 168 V52 A4 4 0 0 1 182 48 H210 A4 4 0 0 1 214 52 V168 Z"/>
<rect class="bill2-bar-solid" x="278" y="138" width="36" height="30"/>
<path class="bill2-bar-hatch" d="M278 138 V52 A4 4 0 0 1 282 48 H310 A4 4 0 0 1 314 52 V138 Z"/>
<path class="bill2-bar-outline" d="M278 168 V52 A4 4 0 0 1 282 48 H310 A4 4 0 0 1 314 52 V168 Z"/>
<rect class="bill2-bar-solid" x="378" y="84" width="36" height="84"/>
<path class="bill2-bar-hatch" d="M378 84 V52 A4 4 0 0 1 382 48 H410 A4 4 0 0 1 414 52 V84 Z"/>
<path class="bill2-bar-outline" d="M378 168 V52 A4 4 0 0 1 382 48 H410 A4 4 0 0 1 414 52 V168 Z"/>
<rect class="bill2-bar-solid" x="478" y="114" width="36" height="54"/>
<path class="bill2-bar-hatch" d="M478 114 V52 A4 4 0 0 1 482 48 H510 A4 4 0 0 1 514 52 V114 Z"/>
<path class="bill2-bar-outline" d="M478 168 V52 A4 4 0 0 1 482 48 H510 A4 4 0 0 1 514 52 V168 Z"/>
<rect class="bill2-bar-solid" x="578" y="144" width="36" height="24"/>
<path class="bill2-bar-hatch" d="M578 144 V52 A4 4 0 0 1 582 48 H610 A4 4 0 0 1 614 52 V144 Z"/>
<path class="bill2-bar-outline" d="M578 168 V52 A4 4 0 0 1 582 48 H610 A4 4 0 0 1 614 52 V168 Z"/>
<text class="bill2-annotation" x="346" y="186">six billed allocations</text>
<text class="bill2-panel-label" x="46" y="234">EC2 &mdash; the host is the billing unit</text>
<line class="bill2-baseline" x1="46" y1="414" x2="646" y2="414"/>
<path class="bill2-bar-outline" d="M46 414 V258 A4 4 0 0 1 50 254 H642 A4 4 0 0 1 646 258 V414 Z"/>
<path class="bill2-bar-solid" d="M78 414 V382 A4 4 0 0 1 82 378 H110 A4 4 0 0 1 114 382 V414 Z"/>
<path class="bill2-bar-solid" d="M178 414 V352 A4 4 0 0 1 182 348 H210 A4 4 0 0 1 214 352 V414 Z"/>
<path class="bill2-bar-solid" d="M278 414 V388 A4 4 0 0 1 282 384 H310 A4 4 0 0 1 314 388 V414 Z"/>
<path class="bill2-bar-solid" d="M378 414 V334 A4 4 0 0 1 382 330 H410 A4 4 0 0 1 414 334 V414 Z"/>
<path class="bill2-bar-solid" d="M478 414 V364 A4 4 0 0 1 482 360 H510 A4 4 0 0 1 514 364 V414 Z"/>
<path class="bill2-bar-solid" d="M578 414 V394 A4 4 0 0 1 582 390 H610 A4 4 0 0 1 614 394 V414 Z"/>
<text class="bill2-annotation" x="346" y="292">shared headroom</text>
<text class="bill2-annotation" x="346" y="432">one billed host</text>
<rect class="bill2-bar-solid" x="46" y="456" width="14" height="14" rx="2"/>
<text class="bill2-legend-text" x="68" y="467">actual use</text>
<rect class="bill2-bar-outline" x="190" y="456" width="14" height="14" rx="2"/>
<text class="bill2-legend-text" x="212" y="467">billed boundary</text>
<rect class="bill2-bar-hatch" x="360" y="456" width="14" height="14" rx="2"/>
<text class="bill2-legend-text" x="382" y="467">billed but idle</text>
</svg>
<p class="demo-caption" style="margin-top:8px">Fig. 1 &mdash; What each model bills. Fargate meters each task's reservation; EC2 meters the host, and tasks share its headroom.</p>
</figure>

That makes any simple price comparison incomplete. Fargate can come out cheaper when traffic is small, irregular, or short-lived; EC2 gets interesting once the workload is steady enough to pack. Region, architecture, instance family, and commitment all move the line — and [Compute Savings Plans apply to both](https://docs.aws.amazon.com/savingsplans/latest/userguide/sp-ris.html), so discounts don't settle it either. The useful comparison is the best realistic version of each architecture, including the waste each one creates.

The premium buys something more valuable than compute. It buys the absence of a fleet.

## The workload changed

Monocle Craft doesn't run one container per request. It runs one container per session. A session holds live state and work that can't share a sandbox, and it stays open across many turns because the next response has to feel immediate. Most of that time is quiet — the container waits for the user, then wakes up and works hard for a moment.

That shape is awkward for Fargate. Every running task has [dedicated capacity](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-security-considerations.html), so one quiet session can't use the CPU or memory left idle by another. Size each task for its busiest moment and the idle time gets expensive; size it too tightly and the busy moment gets fragile.

EC2 exposes another option: reserve memory near a session's normal footprint, keep a higher hard limit, and let CPU be shared when the host has room. Ten quiet sessions can sit beside one another, then borrow from the same spare capacity as they wake.

The word doing the work there is *can*. Shared headroom isn't free capacity — if every session bursts at once, the host still runs out. Reservations need hard limits, utilization needs measurement, and concurrency needs a failure model. Fargate makes the boundary firm. EC2 lets you choose where to draw it.

## Packing is only half

Once tasks can share a host, ECS still has to decide where each new task belongs. A memory-based `binpack` strategy places each new task on the instance with the least remaining memory that can still fit it:

```json
"placementStrategy": [
  { "type": "binpack", "field": "memory" }
]
```

The goal is density: keep busy hosts busy, and leave the others empty enough to disappear later. But `binpack` doesn't remove an instance — it only [chooses among the instances that already exist](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-placement-strategies.html) — and it never moves a running session. It affects the next placement, not the last one.

Capacity is a different layer. A capacity provider connects the cluster to an Auto Scaling group: when tasks can't be placed, managed scaling asks for more instances; when an instance goes empty, it can be released:

<figure class="layers-chart" style="margin:32px 0;">
<svg class="layers-svg" viewBox="0 0 692 632" width="100%" role="img" aria-labelledby="layers-title-1 layers-desc-1" xmlns="http://www.w3.org/2000/svg">
<title id="layers-title-1">Placement vs. capacity: two independent layers in ECS on EC2</title>
<desc id="layers-desc-1">A diagram in two parts. Top: the ECS scheduler places new tasks onto existing EC2 hosts by binpacking on memory — it always chooses the fullest host that still has room, and it never moves a task that is already running. Bottom: a separate capacity provider watches pending tasks, their memory reservations, and any empty hosts, and asks an Auto Scaling group to launch or terminate whole instances. Placement decides which host runs a task; scaling decides how many hosts exist.</desc>
<style>
.layers-chart .layers-box { fill: var(--gray-200); stroke: var(--gray-600); stroke-width: 1; }
.layers-chart .layers-box-strong { fill: var(--gray-200); stroke: var(--label); stroke-width: 2; }
.layers-chart .layers-track { fill: none; stroke: var(--gray-600); stroke-width: 1; }
.layers-chart .layers-fill { fill: var(--gray-300); stroke: var(--gray-600); stroke-width: 1; }
.layers-chart .layers-line { stroke: var(--gray-800); stroke-width: 1; fill: none; }
.layers-chart .layers-ink { stroke: var(--label); stroke-width: 1.5; }
.layers-chart .layers-label { fill: var(--label); font-size: 13px; }
.layers-chart .layers-sub { fill: var(--gray-1000); font-size: 12px; }
.layers-chart .layers-mono { fill: var(--gray-1100); font-family: Mono, ui-monospace, monospace; font-size: 12px; }
.layers-chart text { font-family: inherit; }
.layers-chart .layers-arrowhead { fill: var(--gray-800); }
</style>
<defs>
<marker id="layers-arrow-1" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
<path class="layers-arrowhead" d="M0,0 L8,4 L0,8 Z" />
</marker>
</defs>
<rect class="layers-box" x="130" y="16" width="120" height="42" rx="6" />
<rect class="layers-box" x="286" y="16" width="120" height="42" rx="6" />
<rect class="layers-box" x="442" y="16" width="120" height="42" rx="6" />
<text class="layers-sub" x="190" y="30" text-anchor="middle">task</text>
<text class="layers-mono" x="190" y="47" text-anchor="middle">512m</text>
<text class="layers-sub" x="346" y="30" text-anchor="middle">task</text>
<text class="layers-mono" x="346" y="47" text-anchor="middle">256m</text>
<text class="layers-sub" x="502" y="30" text-anchor="middle">task</text>
<text class="layers-mono" x="502" y="47" text-anchor="middle">512m</text>
<line class="layers-line" x1="190" y1="58" x2="190" y2="70" />
<line class="layers-line" x1="346" y1="58" x2="346" y2="70" />
<line class="layers-line" x1="502" y1="58" x2="502" y2="70" />
<line class="layers-line" x1="190" y1="70" x2="502" y2="70" />
<line class="layers-line" x1="346" y1="70" x2="346" y2="90" marker-end="url(#layers-arrow-1)" />
<rect class="layers-box" x="216" y="92" width="260" height="52" rx="6" />
<text class="layers-label" x="346" y="117" text-anchor="middle">ECS scheduler</text>
<text class="layers-mono" x="346" y="135" text-anchor="middle">binpack by memory</text>
<line class="layers-line" x1="346" y1="144" x2="346" y2="166" />
<line class="layers-line" x1="140" y1="166" x2="552" y2="166" />
<line class="layers-line" x1="140" y1="166" x2="140" y2="190" marker-end="url(#layers-arrow-1)" />
<line class="layers-line" x1="346" y1="166" x2="346" y2="190" marker-end="url(#layers-arrow-1)" />
<line class="layers-line" x1="552" y1="166" x2="552" y2="190" marker-end="url(#layers-arrow-1)" />
<rect class="layers-box" x="50" y="190" width="180" height="132" rx="8" />
<rect class="layers-box-strong" x="256" y="190" width="180" height="132" rx="8" />
<rect class="layers-box" x="462" y="190" width="180" height="132" rx="8" />
<text class="layers-label" x="140" y="209" text-anchor="middle">Host A</text>
<text class="layers-label" x="346" y="209" text-anchor="middle">Host B</text>
<text class="layers-label" x="552" y="209" text-anchor="middle">Host C</text>
<rect class="layers-track" x="66" y="222" width="148" height="80" rx="3" />
<rect class="layers-fill" x="66" y="228" width="148" height="74" />
<rect class="layers-track" x="272" y="222" width="148" height="80" rx="3" />
<rect class="layers-fill" x="272" y="243" width="148" height="59" />
<rect class="layers-track" x="478" y="222" width="148" height="80" rx="3" />
<rect class="layers-fill" x="478" y="283" width="148" height="19" />
<text class="layers-mono" x="140" y="317" text-anchor="middle">96m free</text>
<text class="layers-mono" x="346" y="317" text-anchor="middle">640m free</text>
<text class="layers-mono" x="552" y="317" text-anchor="middle">3.1g free</text>
<text class="layers-sub" x="386" y="179" text-anchor="middle">placed here</text>
<line class="layers-line" x1="386" y1="183" x2="386" y2="190" marker-end="url(#layers-arrow-1)" />
<line class="layers-line" x1="140" y1="347" x2="552" y2="347" marker-start="url(#layers-arrow-1)" marker-end="url(#layers-arrow-1)" />
<line class="layers-ink" x1="341" y1="342" x2="351" y2="352" />
<line class="layers-ink" x1="351" y1="342" x2="341" y2="352" />
<text class="layers-mono" x="346" y="368" text-anchor="middle">no live migration</text>
<rect class="layers-box" x="136" y="392" width="420" height="60" rx="8" />
<text class="layers-label" x="346" y="415" text-anchor="middle">capacity provider</text>
<text class="layers-sub" x="346" y="434" text-anchor="middle">observes: pending tasks · reservation · empty hosts</text>
<line class="layers-line" x1="270" y1="452" x2="270" y2="544" marker-end="url(#layers-arrow-1)" />
<line class="layers-line" x1="422" y1="452" x2="422" y2="544" marker-end="url(#layers-arrow-1)" />
<text class="layers-mono" x="260" y="480" text-anchor="end">launch instance</text>
<text class="layers-mono" x="432" y="508" text-anchor="start">terminate empty instance</text>
<rect class="layers-box" x="216" y="548" width="260" height="50" rx="8" />
<text class="layers-label" x="346" y="578" text-anchor="middle">Auto Scaling group</text>
<text class="layers-sub" x="346" y="618" text-anchor="middle">Placement picks a host for a task. Scaling changes how many hosts exist.</text>
</svg>
<p class="demo-caption" style="margin-top:8px">Fig. 2 — Placement picks a host for a task; scaling changes how many hosts exist. Nothing moves a running task.</p>
</figure>

So the saving appears gradually, not by force. New sessions concentrate on the busier hosts, old sessions end where they are, and a lightly used host eventually drains empty — only then is it safe to remove:

<demo-scalein caption="ECS never moves a running task. Binpack lets an emptied host be reclaimed; a held session keeps its host alive."></demo-scalein>

A live session never hops hosts to improve the packing. Consolidation happens through future placement and natural endings.

## The loop should tend the autoscaler

EC2 still leaves a system to operate. The Auto Scaling group needs bounds. Reservations drift as the product changes; a new model can alter memory use; an AMI that was current last month eventually isn't.

This is where AI helps — but not by becoming a second autoscaler. AWS already has mechanisms for placing tasks, adding capacity, protecting instances, and draining them. Replacing those with an agent trades a predictable control system for a creative one, and creativity is not what scale-in needs.

The loop belongs one level up: comparing reservations with observed usage and flagging drift, watching pending tasks and idle hosts, tracking AMI age and proposing a replacement cadence, noticing when a drain has stalled, explaining why a task couldn't be placed before anyone opens five dashboards.

Its authority should be narrower than its attention. It may observe the whole system while changing only bounded values — a reservation change goes through review, a scale-in requires an empty host, a fleet adjustment moves one step at a time and stops when an invariant breaks:

<demo-loop caption="Each click is one tick. The loop's authority is narrower than its attention — it flags; it doesn't scale."></demo-loop>

The loop should not be the autoscaler. It should tend the autoscaler. That's still meaningful: much of the cost of owning EC2 was never writing the Auto Scaling group. It was the small checks around it — whether the settings still matched reality, whether patching was current, whether yesterday's assumptions had quietly expired. A person had to remember to look. A loop doesn't.

## The choice is no longer binary

There's now a third answer between Fargate and a fleet you run yourself. [ECS Managed Instances](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ManagedInstances.html) packs multiple tasks onto EC2 instances while AWS handles selection, provisioning, scaling, and patching. It keeps most of EC2's packing advantage without handing you the host lifecycle — worth evaluating before building any loop. The constraints are real, though: AWS controls the instances, custom AMIs and host access are out, and instances get replaced on a cadence. A session that can't survive planned replacement may not fit.

So the decision looks closer to this:

- Fargate: when tasks are short-lived, traffic is irregular, scale-to-zero matters, or isolation is worth more than shared headroom.
- Managed Instances: when you want the packing without operating the fleet.
- EC2 with your own Auto Scaling group: when the workload is dense and sustained, host-level control matters, or long-running sessions make managed replacement awkward.

Spot capacity is a separate decision, not a fourth architecture — use it only where interruption is an expected event. A warm session needs checkpointing before a discount makes termination acceptable.

## Revisit the default

Fargate didn't get worse. The workload changed. Long-lived sessions make reserved idle capacity easy to see, and better automation makes the alternative cheaper to tend. That moves the line; it doesn't erase it. Shared hosts introduce contention, scaling introduces lag, and every new control surface is another way to be wrong. The host is an asset only when its headroom is useful and its failure modes are understood. Otherwise it's still work, and Fargate's premium is still buying something real.

The old default was priced for a world where every host needed someone's attention. That world is changing. The host isn't disappearing — but the job attached to it is getting smaller.
