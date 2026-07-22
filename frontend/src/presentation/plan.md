# Presentation Mode Plan

## Overview
This directory houses the components for the new Presentation Mode feature in Songpacketer.
The goal is to provide a minimalist, full-screen, PowerPoint-like presentation experience directly from the packet details.

## Requirements
1. **Full Screen, Minimalist:** Designed with few distractions.
2. **Homepage:** Shows a song list. Clicking a song opens it full screen.
3. **Song View:** 
   - Verses and chorus are split up.
   - The bottom shows the number of verses (each clickable) and indicates the current one.
   - Navigation arrows through verses, with an option to insert a chorus between each verse.
   - Option to show/hide chords and add/change capo on the fly.
4. **Navigation:** A home button on every screen.
5. **Search/Filter:** Minimalistic search/filter bar on the home screen that searches song titles and contents.
6. **Customization:** Ability to set text and background color with a few obvious preset options.

## Components to Build
- `PresentationMode.jsx`: The main wrapper and state manager.
- `PresentationHome.jsx`: The homepage with the song list and search bar.
- `PresentationSlide.jsx`: The full-screen song slide with verses, choruses, and navigation.
- `utils.js`: Logic to parse ChordPro text into split verses and choruses.
