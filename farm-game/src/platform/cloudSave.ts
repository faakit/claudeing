/**
 * Cloud save, provider-agnostic (DECISIONS.md, "Cloud save"). Two contracts:
 *
 *  - `CloudProvider`: one storage backend holding one blob, the exact JSON the game keeps locally. Play Games
 *    Saved Games on Android (`cloud/playGames.ts`), a fake for tests and scenarios (`cloud/fake.ts`).
 *  - `CloudSave`: what the game uses (`game/cloudSync.ts` implements it): status, sign in/out, the cloud save,
 *    debounced sync with offline queueing, and the conflict rules (`systems/cloudRules.ts`).
 *
 * With no provider (the web build, iOS, an Android build without a Play Games project id) the status is
 * `unavailable`, nothing shows, and the game saves locally exactly as before.
 */
import type { GameState } from '../state/GameState';
import type { SaveSummary, Verdict } from '../systems/cloudRules';

/** Why a provider call failed. `offline` is queued and retried; the rest stop until the player acts. */
export type CloudErrorKind = 'offline' | 'signedOut' | 'unavailable' | 'failed';

export class CloudError extends Error {
  constructor(
    readonly kind: CloudErrorKind,
    message: string = kind,
  ) {
    super(message);
  }
}

/** The blob in the cloud and when the provider last changed it (ms). */
export interface CloudBlob {
  data: string;
  modified: number;
}

/** What a provider may show next to the blob (Play Games' saved-games list). Derived from the save itself. */
export interface CloudMeta {
  description: string;
  playedTimeMs: number;
  /** Larger is further along (Play Games resolves its own rare conflicts by it). */
  progress: number;
}

export interface CloudProvider {
  /** A short id ("play-games", "fake"). */
  readonly id: string;
  /** Configured and usable on this device. Never throws. */
  available(): Promise<boolean>;
  /** The signed-in account's display name, silently (no UI), or null. */
  account(): Promise<string | null>;
  /** Interactive sign-in (may show the provider's sheet). Resolves the account name, or null if declined. */
  signIn(): Promise<string | null>;
  /** Forget the account where the provider can (Play Games v2 cannot: the game then just stops syncing). */
  signOut(): Promise<void>;
  /** The cloud blob, or null when there is none. Throws `CloudError`. */
  load(): Promise<CloudBlob | null>;
  /** Replace the cloud blob. Resolves the provider's modified time. Throws `CloudError`. */
  save(data: string, meta: CloudMeta): Promise<number>;
}

/**
 *  - unavailable  no provider here: cloud save is hidden
 *  - off          the player turned it off (or never turned it on where sign-in is manual)
 *  - signedOut    available, nobody signed in
 *  - signingIn    the provider's sign-in is showing
 *  - idle         signed in, nothing synced yet this session
 *  - syncing      a load or an upload is running
 *  - synced       the cloud holds this phone's save
 *  - pending      an upload is queued (offline); retried on its own
 *  - conflict     the cloud save is further along, or the two diverged: the player must choose
 *  - newer        the cloud save comes from a newer version of the game: never overwritten
 *  - error        the last call failed for another reason (retried on the next trigger)
 */
export type CloudState =
  | 'unavailable'
  | 'off'
  | 'signedOut'
  | 'signingIn'
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'pending'
  | 'conflict'
  | 'newer'
  | 'error';

export interface CloudStatus {
  state: CloudState;
  /** The signed-in account's display name (Play Games gamer name), when known. */
  account: string | null;
  /** When the cloud last matched this phone's save (ms), or null. */
  lastSync: number | null;
}

/** Two saves that do not agree, for the player to choose between. */
export interface CloudConflict {
  verdict: Extract<Verdict, 'cloud' | 'conflict'>;
  /** This phone's save (null on a phone with none, e.g. a new install). */
  local: SaveSummary | null;
  cloud: SaveSummary;
  /** The cloud save, migrated and sanitized (what "Use the cloud save" starts). */
  cloudState: GameState;
}

/** Why a sync was asked for. `pause` flushes at once (the app may be killed); the rest are debounced. */
export type SyncReason = 'sleep' | 'pause' | 'resume' | 'online' | 'manual' | 'retry' | 'signIn';

export interface CloudSave {
  readonly status: CloudStatus;
  /** Set while the player has a choice to make (state `conflict`). */
  readonly conflict: CloudConflict | null;
  /** Called on every status or conflict change. Returns an unsubscribe function. */
  onChange(fn: () => void): () => void;
  signIn(): Promise<boolean>;
  signOut(): Promise<void>;
  /** The cloud save if it is one the title should offer (newer than, or diverged from, `local`). */
  load(local: GameState | null): Promise<CloudConflict | null>;
  /** Ask for an upload of the local save (debounced; `pause` and `manual` run at once). */
  save(reason: SyncReason): Promise<void>;
  /** The player chose: keep this phone's save (it goes up) or use the cloud's (returned, already saved here). */
  resolve(choice: 'local' | 'cloud'): Promise<GameState | null>;
}
