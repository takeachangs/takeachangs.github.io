---
title: Mike
description: A free Mac app in the notch that transcribes lectures on-device and takes full-duplex voice calls. Made for a UofT AI workshop.
icon: /images/mike-icon.png
---

I made Mike for a workshop I'm teaching at UofT AI. Every dictation app the students could find was paid — a strange thing to ask of people who just want their lectures written down. So I took [Parakeet Ultra](https://huggingface.co/FluidInference/parakeet-ultra-coreml), a speech-to-text model small enough to run on the Neural Engine, and wrapped it in an app. It sits in the notch, transcribes lectures and meetings as they happen, and keeps a library of everything it heard. The audio never leaves the Mac. It costs nothing.

## Call

There's a second button. *Call* opens a line to the model behind ChatGPT's voice mode — full duplex, so it listens while it talks and you can cut it off mid-sentence. I talk to it every day. On its own it's a voice assistant, which is fine and a little boring. Pointed at a coding-agent session it gets interesting: while you speak, the voice delegates questions to the agent, which digs through the session and answers back, asynchronously, so the conversation never stalls. You end up *arguing with your code*, out loud, and the code argues back with the context in hand. Bring your own OpenAI key.

[Download for macOS →](https://github.com/takeachangs/mike/releases/latest/download/Mike.dmg)
