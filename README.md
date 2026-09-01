# Motofy Garage App

Motofy is a zero-friction garage workspace built around vehicle plate scanning.

## Local preview

Serve this folder with any static web server because camera access requires `localhost` or HTTPS.

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Files

- `index.html` — complete Motofy interface and plate-scanning flow
- `store.js` — local-first data layer with IndexedDB, Supabase sync and vehicle photos
