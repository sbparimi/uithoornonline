# Uithoorn.online — mobile app (Android first, iOS later)

React Native + Expo (TypeScript). Package id `online.uithoorn.app`, app name **Uithoorn.online**.
Dutch by default, English toggle in *Account → Taal / Language*. Talks to the live website's API
(`https://uithoorn.online`), so accounts, businesses, requests and chats are the same as on the site.

## What's in the app
**Residents**: browse/search businesses by category · business page (call, website, map, share, reviews)
· post a request (same categories/fields as the site) · *My requests* with replies and chat.
**Businesses**: sign up (all site categories + "Anders / overig" free text) · log in · see matching
requests · reply (starts a chat) or decline · chat · edit business profile.
**Account**: language NL/EN, notifications permission, contact (sam@uithoorn.online), privacy, terms, log out.

## Run it on your Mac in the Android emulator

One-time setup:
1. Install **Node 20 LTS** (or newer): https://nodejs.org (or `brew install node@20`).
2. Install **Android Studio**: https://developer.android.com/studio
   - First launch → *Standard* setup (installs the Android SDK, platform-tools and the emulator).
   - *More Actions → Virtual Device Manager → Create device* → **Pixel 8** → system image **API 35**
     (on Apple Silicon pick the *arm64-v8a* image) → Finish → press ▶ to start it.
3. Install **JDK 17** (Android Studio bundles one; or `brew install --cask zulu@17`).
4. Add to `~/.zshrc`, then open a new terminal:
   ```sh
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
   ```
   Check: `adb devices` lists `emulator-5554   device`.

### Option A — install the ready-made APK (fastest)
```sh
adb install -r uithoorn-online-1.0.0-release.apk      # or the -debug.apk
adb shell monkey -p online.uithoorn.app 1             # launches it
```
(You can also drag the .apk file onto the running emulator window.)

### Option B — build and run from source (VS Code)
```sh
git clone https://github.com/sbparimi/uithoornonline.git
cd uithoornonline/mobile
npm install
npx expo run:android          # builds a debug app, installs it on the emulator and starts Metro
```
Edit any file in `src/` and the app reloads instantly. Press `r` in the terminal to reload, `m` for the dev menu.
Recommended VS Code extensions: *Expo Tools*, *ESLint*, *React Native Tools*.

Faster loop without a native build: `npx expo start` then press `a` (opens in the emulator via Expo Go)
or `w` (opens in the browser).

### Which server does the app use?
Production by default: `https://uithoorn.online`. To point at another deployment (e.g. a Vercel preview),
set `EXPO_PUBLIC_API_URL` before starting/building:
```sh
EXPO_PUBLIC_API_URL=https://uithoornonline-git-my-branch-shyenaai.vercel.app npx expo run:android
```
(Preview deployments behind Vercel Deployment Protection need the protection disabled or a bypass.)

## Build a release (APK for direct install, AAB for Google Play)
```sh
cd mobile
npm install
npx expo prebuild --platform android --clean     # generates ./android (not committed)
# signing: copy the upload keystore + keystore.properties (kept privately, NOT in git) — see below
cd android
./gradlew assembleRelease bundleRelease
# → android/app/build/outputs/apk/release/app-release.apk
# → android/app/build/outputs/bundle/release/app-release.aab
```
Signing: `scripts/apply-signing.mjs` wires `android/keystore.properties`
(`storeFile`, `storePassword`, `keyAlias`, `keyPassword`) into the release build after prebuild:
`node scripts/apply-signing.mjs /path/to/keystore.properties`. Keep the upload keystore and its
passwords safe: every future Play update must be signed with the same upload key (Play App Signing
can reset a lost upload key, but it takes days).

Bump `expo.version` and `expo.android.versionCode` in `app.json` for every Play upload.

## How the app talks to the server
- Login/signup: the site's `/api/auth/login` and `/api/auth/signup`. The app sends `X-UO-Client: mobile`
  and receives a session `token`, stored in the phone's secure storage (Android Keystore), and sent as
  `Authorization: Bearer <token>`. Same 30-day sessions as the website.
- Read endpoints added for the app: `GET /api/mobile/meta` (categories, timing, urgency, links),
  `GET /api/mobile/businesses[?q=&category=]`, `GET /api/mobile/businesses/:id`, `GET /api/mobile/me`,
  `GET /api/mobile/conversations/:id`.
- Shared with the website: `POST /api/requests`, `GET|PATCH /api/provider/leads`,
  `POST /api/provider/requests/:id/accept`, `GET|PATCH /api/provider/profile`,
  `GET|POST /api/conversations/:id/messages`, `POST /api/auth/signout`.

## Notifications
Phase 1 (this version): the app asks permission, sets up the Android channel, and shows a notification
when it finds a new message/request while it is open or in the background.
Phase 2 (server push when the app is closed): needs a Firebase project → add `google-services.json`
(`expo.android.googleServicesFile`), store device tokens server-side, send via FCM/Expo push.

## Project layout
```
App.tsx                 providers + splash/font gate
src/api.ts              fetch wrapper (token, errors) + types
src/auth.tsx            session (secure storage), login/signup/logout
src/i18n.tsx            all Dutch/English texts
src/meta.tsx            categories etc. from /api/mobile/meta (bundled fallback: meta-fallback.json)
src/navigation/         tabs (resident vs business) + stack
src/screens/            Discover, Business, Request, Mine, Leads, Lead, Messages, Profile, Conversation, Login, Signup, Account
src/components/ui.tsx   buttons, fields, select sheet, cards, badges (site brand: #2250CE, Averia Serif)
assets/                 icon, adaptive icon, splash, notification icon
store/                  Play Store listing texts
```
