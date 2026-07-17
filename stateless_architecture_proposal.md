# Moving to a 100% Client-Side App

**The Goal**: Delete the Django backend and Postgres database entirely. Run everything in the browser.

## How it works
- **Songs**: Fetch the catalog from songbase.life once and cache it in the browser (`IndexedDB`).
- **Saves**: Save your active song packets locally in the browser (`localStorage`).
- **PDFs**: Rewrite the Python PDF generator (`pdf.py`) in JavaScript (using `@react-pdf/renderer` or `pdfmake`) so PDFs generate right in the browser.

## Why do this?
- **Free hosting forever** as a static site on Vercel.
  - *Note: Vercel provides a seamless edge redirect (`vercel.json`) that proxies the Songbase API. This elegantly bypasses browser CORS restrictions when syncing the library, requiring zero backend code on our end.*
- **No more Docker** or database headaches for local development.
- **Works entirely offline**. 

## The Catch
- We have to rewrite 1,100 lines of complex Python PDF layout code into JavaScript. 
- If users clear their browser data, their saved packets are wiped out (unless they use an Export to JSON feature first).

## Next Steps
1. Switch the React app to save packets to local storage instead of the backend.
2. Build a local cache for the master song library.
3. Port the Python PDF generator to JavaScript.
4. Delete the entire `backend/` folder and `docker-compose.yml`.
