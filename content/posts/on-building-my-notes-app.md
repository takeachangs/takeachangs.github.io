---
title: On Building My Notes App
description: Finding the balance between explosion and implosion of features.
date: 2026-08-20
---

There are two ways a personal notes system dies. It explodes — folders, tags, backlinks, a graph, every feature asking a question before a note is allowed to exist. Or it implodes — you text yourself, zero features, and the thought lands instantly in a place you'll never look again. I've killed systems both ways. Minote, the app I ended up building, is a bet that the balance between the two isn't where I thought it was.

## Power at the wrong end

I went the maximal route first. My last serious system parsed everything I saved into a knowledge graph — entities, links, clustered communities. Superpowered on paper, and all of the power sat at the wrong end of the pipe. Every capture opened with questions: where does this live, what is it called, what does it connect to. A running thought expires in the `1–2s` it takes to answer even one of them. What survived the filing was immaculate — and untouched. Inputs, never *outputs*. The organization had become the product, and the product wasn't notes.

## A chat with nobody

So I collapsed to the opposite extreme: I messaged myself. A chat thread is the fastest capture surface ever shipped — one field, one send, no filing, and the muscle memory already exists. But zero features has its own death. Saves bury saves; a link from March is forty flicks up; search knows my words but not what the photo or the page said. And the whole thing lives inside a messenger — behind a contact of myself I had to maintain, next to every conversation engineered to pull me somewhere else. Capture solved, retrieval abandoned: the same graveyard, with faster burials.

## Implode the capture

Minote keeps the implosion — but only on the way in. Every capture is the same gesture: type, send, done. No folder, no title, no tag; photos and links arrive through the system share sheet with the same zero questions. Structure appears after the fact, from time alone — day dividers, a date header that follows the scroll. The capture side of the app is finished precisely because there is nothing left to remove.

## Explode the retrieval

Every feature the capture side refused went to the other end. The bottom bar inverts the chat grammar: search is the long element and compose is a small circle beside it, because in a personal archive you retrieve more than you create. One bar holds both roles, and switching between them is free:

<demo-minote-bar caption="Tap the pill to search, the circle to compose, the card to rest."></demo-minote-bar>

Tap the pill and it melts into a search field; tap the circle and it grows into a composer. Underneath, every note indexes itself on device — a link archives the page's `og:description`, a photo runs OCR and image labels the moment it lands — and the ranking stays legible: a match in your own words scores `3`, a match in derived text scores `2`, recency breaks ties. Found notes accept replies, replies form threads, and a swipe opens a sidebar that lists threads as units, so a topic survives being buried by newer saves.

<div class="phones"><figure class="phone"><img loading="lazy" decoding="async" src="/images/minote-feed.png" alt="Minote's feed: a photo note, a link card, and text notes in a chat-style timeline with the search bar at the bottom"></figure><figure class="phone"><img loading="lazy" decoding="async" src="/images/minote-threads.png" alt="The push-drawer sidebar listing threads as units, with note counts"></figure></div>

<p class="demo-caption">The real thing: the feed (capture) and the threads sidebar (retrieval).</p>

The balance between explosion and implosion turned out not to be a midpoint. It's an *asymmetry*: a notes system should implode at the exact moment a thought arrives, and explode at the exact moment you reach back for one. Spend nothing on the way in. Spend everything on the way back.
