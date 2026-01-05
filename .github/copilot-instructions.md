# Ayozia — Copilot / AI-Agent Instruktionen

Diese Datei fasst die wichtigsten, projektspezifischen Hinweise zusammen, damit ein KI-Coder in diesem Repository schnell produktiv wird.

Kurzüberblick
- Frontend: Expo / React Native mit `expo-router` (app/)
- Backend: Express (server/server.js) — persistiert in JSON-Dateien (`server/*.json`)
- Statische Uploads: `server/uploads/{avatars,media,voice}` werden vom Backend ausgeliefert

Wichtige Orte (schnell referenzieren)
- Frontend-Routing & Auth: `app/_layout.tsx` (suche `AUTH_ROUTES`)
- Profil Upload UI: `app/profile/upload/image.tsx` (zeigt axios-multipart + onUploadProgress)
- Chat UI & Logik: `app/chat/` (z.B. `[id].tsx`, `autoscrollflatlist.tsx`)
- Backend-Entry: `server/server.js` (API-Routen, MESSAGES-Logik)
- Upload-Routen: `server/routes/media.js`, `server/routes/voice.js`
- Daten: `server/users.json`, `server/follows.json`, `server/messages.json`

Kontrakt / Erwartungen (kurz)
- API base URL: konfigurierbar via `EXPO_PUBLIC_API_URL`, default: `http://192.168.0.224:5000` (siehe `app/profile/upload/image.tsx`).
- Uploads: Endpunkte erwarten `multipart/form-data`; Backend liefert Dateien unter `/uploads/*` statisch aus.
- Auth: Session wird per AsyncStorage im Frontend gehalten; `AUTH_ROUTES` listet geschützte Pfade.

Projekt-spezifische Patterns & Beispiele
- Dateibasiertes Routing: neue Seiten in `app/` ablegen — z.B. `app/feature.tsx`. Für geschützte Routen in `app/_layout.tsx` `AUTH_ROUTES` ergänzen.
- Media Uploads: `app/profile/upload/image.tsx` baut ein FormData mit `file`, `userId`, `caption` und ruft `http.post('/media/images', form, { headers: ..., onUploadProgress })` auf — halte Header `Content-Type: multipart/form-data` minimal und lass axios den Boundary setzen.
- Chat: Messages werden lokal in `server/messages.json` gespeichert; Frontend-Komponenten nutzen optimierte FlatList-Patterns (autoscroll, keyExtractor).
- Backend-JSON: Änderungen an Datenstrukturen erfordern meist Anpassungen in `server/server.js` (Lese-/Schreibroutinen). Schemas sind informell — folge bestehenden Einträgen (id, username, avatarUrl etc.).

Start & Debug (Windows PowerShell)
- Frontend (Root):
```powershell
npm install
npx expo start -c
```
- Backend (server/):
```powershell
cd server; node server.js
```
Hinweis: Wenn das Gerät/emulator nicht auf die lokale IP zugreifen kann, setze `EXPO_PUBLIC_API_URL` in der Shell auf die erreichbare IP (z. B. `powershell: $env:EXPO_PUBLIC_API_URL='http://192.168.0.224:5000'; npx expo start -c`).

Editing / Pull-Request Hinweise für AI-Änderungen
- Kleine Änderungen bevorzugen: mehrere kleine, gut getestete Commits statt großer Umbauten.
- Beibehaltung von Stil: Frontend ist TypeScript/React Native — vermeide Rückfall auf plain JS in bestehenden Dateien.
- Wenn du API-Verhalten änderst: aktualisiere simultan `server/*.json` Beispiel-Daten und relevante Frontend-Calls.

Risiken / Edge-Cases zu beachten
- JSON-Backends können Race-Conditions haben bei parallelen Schreibzugriffen — backend-seitige Locking/Queueing ist hoheitsgebiet von `server/server.js`.
- Media-Uploads: Achte auf MIME-Types und Dateigrößen; frontend-komprimierung erfolgt teilweise in `expo-image-picker`.

Quick-fixes & Beispiele
- Um eine neue Upload-Route hinzuzufügen: ergänze in `server/routes/` eine neue Route, exportiere und `require()` sie in `server/server.js`.
- Beispiel-Referenz: `app/profile/upload/image.tsx` (multipart FormData + onUploadProgress) und `server/routes/media.js` (Empfang und Speicherung).

Feedback
Wenn etwas fehlt oder du besondere Workflows (CI, Tests, externe APIs) nutzt, sag kurz Bescheid — ich ergänze die Anleitung.