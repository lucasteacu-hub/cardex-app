# CarDex prototype specification

CarDex is a cross-platform mobile prototype for collecting cars. A user photographs a car or chooses an existing image, optionally asks an AI service to identify it, reviews the suggested identity and specifications, and saves the original photo and metadata to a local garage.

This document describes the functionality that exists in the prototype. It does not describe the future Apple-style Liquid Glass redesign, cloud accounts, background removal, or a public production backend.

## User flow

1. The app loads the local collection from device storage.
2. **Catch a car** opens the camera after requesting permission. **Choose from photos** opens the photo library. The picker configuration is in [App.tsx:74](./App.tsx:74).
3. The new-catch screen shows the photo. The user can enter a make and model manually.
4. **Identify this car** creates a smaller JPEG copy, sends it through the Mac's development server, and asks the vision model for a structured result. The mobile request is in [recognize.ts:5](./src/services/recognize.ts:5).
5. The user reviews the result, including confidence, clues, alternatives, and details. The result is rendered by [CarDetails.tsx:4](./src/components/CarDetails.tsx:4).
6. The user can correct the make or model before saving. If the identity changes, the old AI specifications are discarded so they cannot be attached to a different car; see [App.tsx:62](./App.tsx:62) and [App.tsx:101](./App.tsx:101).
7. Saving copies the original photo into the app's document directory and writes the collection record to local storage. See [App.tsx:91](./App.tsx:91).
8. The garage displays cards, counts brands, supports make/model search, opens a detail view, and allows confirmed removal. See [App.tsx:123](./App.tsx:123) and [App.tsx:110](./App.tsx:110).

## Record types

### `Car`

Defined at [App.tsx:12](./App.tsx:12).

| Property | Type | Meaning |
| --- | --- | --- |
| `id` | `string` | Local unique identifier made from the timestamp and a random suffix. |
| `make` | `string` | User-confirmed or AI-suggested manufacturer name. Required to save. |
| `model` | `string` | User-confirmed or AI-suggested model name. Required to save. |
| `uri` | `string` | Local file URI for the copied original photo. |
| `caughtAt` | `string` | ISO timestamp for when the car was saved. |
| `recognition` | `Recognition \| undefined` | AI result saved only when it belongs to the saved make/model and has an identified or uncertain status. |

The record is persisted as JSON under the versioned key `cardex.collection.v1`, declared at [App.tsx:13](./App.tsx:13). The collection is loaded and lightly validated at [App.tsx:64](./App.tsx:64), then written at [App.tsx:102](./App.tsx:102).

### `Recognition`

The TypeScript shape is declared at [shared/recognition.d.ts:1](./shared/recognition.d.ts:1). The runtime JSON schema is constructed in [shared/recognition.js:15](./shared/recognition.js:15).

| Property | Type | Meaning |
| --- | --- | --- |
| `status` | `identified \| uncertain \| no_car \| multiple_cars` | Whether one car was identified confidently enough to suggest. |
| `make` | `string \| null` | Manufacturer. Null for no-car or multiple-car results. |
| `model` | `string \| null` | Model. Null for no-car or multiple-car results. |
| `confidence` | `high \| medium \| low \| unknown` | Overall confidence. |
| `summary` | `string` | Short explanation and uncertainty note. |
| `visualClues` | `string[]` | Evidence visible in the photo. |
| `alternatives` | `string[]` | Possible competing identities when the result is uncertain. |
| `details` | `Record<DetailKey, Detail>` | Detail fields listed below. |

Each detail has `value`, `basis`, and `confidence`. `basis` distinguishes `visible` evidence from `model_knowledge`; `unknown` means the system did not have enough support. This is enforced by [shared/recognition.js:37](./shared/recognition.js:37).

The current detail keys are: generation, possible model years, trim/variant, body style, colour, engine, power, torque, transmission, drivetrain, fuel/power source, 0–100 km/h, and top speed. The labels are defined at [shared/recognition.js:1](./shared/recognition.js:1).

## AI behaviour

The prototype uses OpenAI's Responses API with an image input and strict JSON schema output. The server prompt tells the model to report uncertainty, avoid inventing specifications, and treat visible text as evidence rather than instructions. Read the policy and prompt at [server/recognition.cjs:4](./server/recognition.cjs:4).

The request uses `store: false`, `gpt-4.1-mini` by default, a 45-second provider timeout, and a maximum output size. The API call and error mapping are at [server/recognition.cjs:8](./server/recognition.cjs:8).

The client sends only a resized JPEG copy of the selected image. The original stays on the device and is copied into the garage only when the user saves. See [recognize.ts:11](./src/services/recognize.ts:11) and [App.tsx:96](./App.tsx:96).

The development endpoint rejects missing authentication, missing credentials, non-JSON requests, oversized bodies, concurrent scans, and more than 30 scans in an hour. See [server/recognition.cjs:37](./server/recognition.cjs:37). It is attached to Metro by [metro.config.js:11](./metro.config.js:11), so it is suitable for local testing only.

## Technology choices

### Expo and React Native

The app uses Expo SDK 57, React Native, and TypeScript. This gives one codebase for iOS and Android and lets the prototype run in Expo Go. The dependency versions are recorded in [package.json:5](./package.json:5).

### Expo ImagePicker

`expo-image-picker` provides camera and photo-library access. The app requests camera permission only when the user chooses the camera and handles denial with an option to open Settings; see [App.tsx:78](./App.tsx:78). The permission wording is configured in [app.json:9](./app.json:9).

### Expo FileSystem

`expo-file-system` stores a durable copy of each original image in the app's document directory. This separates a saved catch from a temporary picker URI; see [App.tsx:96](./App.tsx:96).

### AsyncStorage

`@react-native-async-storage/async-storage` stores the collection metadata as JSON. It is simple and sufficient for a local prototype. A production version would likely use SQLite or a hosted database for accounts, syncing, and larger collections.

### Expo ImageManipulator

`expo-image-manipulator` resizes and compresses the image before recognition, reducing upload size and cost. See [recognize.ts:11](./src/services/recognize.ts:11).

### Local Metro middleware

The API key remains on the Mac instead of being bundled into the phone app. `server/config.cjs` reads the ignored credentials file or `OPENAI_API_KEY`; see [config.cjs:11](./server/config.cjs:11). `metro.config.js` blocks server and credential paths from being served to the mobile bundle at [metro.config.js:6](./metro.config.js:6).

## Important state and safety decisions

- `busy` and `locked` prevent overlapping camera, save, and removal operations; see [App.tsx:19](./App.tsx:19) and [App.tsx:74](./App.tsx:74).
- `AbortController`, a scan version, and a 60-second client timeout prevent a late AI response from overwriting a newer photo; see [App.tsx:40](./App.tsx:40).
- A failed save keeps the draft photo available and attempts to remove only the temporary copied file; see [App.tsx:105](./App.tsx:105).
- AI details are displayed as suggestions and show whether they came from the photo or model knowledge; see [CarDetails.tsx:6](./src/components/CarDetails.tsx:6).
- The API key must never be placed in the mobile bundle or chat. The ignored local setup file is `server/credentials.local.json`; the setup helper is [scripts/setup-ai.cjs](./scripts/setup-ai.cjs).

## Current limitations and next design steps

The prototype has no user accounts, cloud sync, production HTTPS backend, background removal, manufacturer database lookup, or guaranteed exact trim/year identification. A photo often cannot prove an engine, market, transmission, or trim, so the current data model deliberately stores unknowns and confidence instead of pretending certainty.

The next major architectural step would be a real backend with user authentication, server-side rate limits, a car specification data source, and an image-processing service. The planned visual direction—light/dark modes, purple accents, tabs, and Apple-style Liquid Glass—should be treated as a UI specification for a later iteration.

