# CarDex — first prototype

A native iOS and Android app built with Expo and React Native. Take a photo or select one, enter a make and model, and collect cars in a searchable garage.

## What works

- Camera permission flow and photo selection
- Make and model entry, collection counts, search, detail view, and confirmed removal
- Photos copied into persistent app storage, with collection metadata stored locally
- Loading, cancellation, permission denial, and storage failure handling

AI recognition is implemented and requires an OpenAI API key with API billing enabled. Tapping **Identify this car** sends a resized JPEG copy to OpenAI through the Mac preview server. Make/model suggestions, confidence, visual clues, alternative matches, and 13 specification fields can be reviewed and saved with the original photo. Unknown details remain unknown. Specs are AI model knowledge, not a live manufacturer database lookup. Background removal is not implemented. There is no account or cloud backup; uninstalling the app can remove its collection.

## Try it on an iPhone

Install Expo Go from https://expo.dev/go and sign into a free Expo account. The Mac and phone should be on the same Wi-Fi. Current Expo instructions require the same Expo account in Expo Go and Expo CLI on physical iOS devices.

With Node.js and npm installed:

```sh
cd '/Users/karus/Documents/New project/cardex'
npm install
npx expo login
npx expo start
```

Scan the terminal QR code with the iPhone Camera app. This project uses Expo SDK 57; use a compatible version of Expo Go. Expo Go is a preview environment, not an App Store release.

This Mac currently uses the Node runtime bundled with Codex. During this session, the equivalent commands are:

```sh
export PATH="/private/tmp/cardex-tools/node_modules/.bin:/Users/karus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
cd '/Users/karus/Documents/New project/cardex'
node node_modules/expo/bin/cli login
node node_modules/expo/bin/cli start
```

## Checks

```sh
npx tsc --noEmit
npx expo export --platform ios --platform android
```

Physical-device checks still needed: deny camera access, cancel camera/picker, photograph a car, save it, reopen the app and confirm its image persists, search by make/model, open details, cancel removal, then confirm removal. Test on both iOS and Android before distribution.

## Enable AI recognition

1. Create an OpenAI API key at https://platform.openai.com/api-keys and enable API billing. Do not share the key in chat or put it in the mobile app.
2. On the Mac, run `npm run setup:ai` in this project. The prompt hides the pasted key and writes a git-ignored, owner-readable `server/credentials.local.json`. Alternatively, set `OPENAI_API_KEY` in the server process environment.
3. Restart Expo after installing this integration; reconnect Expo Go to refresh its manifest. Tap **Identify this car** after selecting a photo. Saving a key later does not need another restart.

On this Mac, without a system Node installation, double-click `Setup AI.command` in Finder. It uses the available Codex Node runtime and the same private prompt.

The backend uses OpenAI Responses image input with a strict JSON schema, `store: false`, and `gpt-4.1-mini` by default (`OPENAI_MODEL` can override it). It does not log photos, provider responses, or keys. The original photo stays on the phone; the API receives a smaller JPEG copy. API data handling still follows the provider's policies.

This is a **development-only backend attached to Metro** at `/api/recognize`, so it uses the same working hotspot/Wi-Fi connection as Expo Go. It has a development pairing token, one concurrent scan, a 30-attempt hourly limit per process, body limits, and timeouts. The pairing token is delivered in the Expo manifest; it is not production authentication. Do not publicly deploy this preview as a paid API. A release needs a hosted HTTPS backend with real user authentication and durable usage limits. Live recognition is intentionally disabled in release builds until that backend exists.

If make/model is manually changed, previous AI specs are discarded to avoid attaching them to the wrong car. Earlier saved collections still load. A refused, failed, cancelled, or timed-out scan never creates a fake identification or removes the original photo.

## Validation

Run `npm test`, `npm run typecheck`, and `npm run lint`. Tests mock the provider and cover valid responses, unknown/ambiguous cars, invalid results, authentication, missing credentials, oversized inputs, provider errors, rate limits, and concurrent requests. Both iOS and Android bundles were exported successfully. Live AI recognition and physical-device save/reopen tests still require the API key and phone testing.

Next milestone: verify real car photos, then add background removal as a separate feature.

