/**
 * A cloud in memory, for unit tests, scenarios (`dev.cloud`) and `?debug&cloud=fake`. Every behaviour a real
 * provider can show is a switch: signed in or out, offline, a failing call, a slow call, a corrupt blob.
 */
import { CloudError, type CloudBlob, type CloudMeta, type CloudProvider } from '../cloudSave';

export interface FakeCloudOptions {
  /** The signed-in account, or null for signed out. */
  account?: string | null;
  /** The blob already in the cloud. */
  data?: string | null;
  offline?: boolean;
  /** ms each call takes. */
  latency?: number;
  /** Sign-in is declined (the player closed the sheet). */
  declineSignIn?: boolean;
}

export class FakeCloudProvider implements CloudProvider {
  readonly id = 'fake';
  user: string | null;
  data: string | null;
  modified = 0;
  offline: boolean;
  latency: number;
  declineSignIn: boolean;
  /** The next call fails this way once. */
  failNext: CloudError['kind'] | null = null;
  /** Every call, in order (tests read it). */
  readonly calls: string[] = [];
  /** The metadata of the last upload. */
  lastMeta: CloudMeta | null = null;
  private clock = 1;
  /** The account a fake signs in as unless told otherwise (a sandbox name, the same in every language). */
  static readonly DEFAULT_ACCOUNT = 'Farmer'; // i18n-ok: a test account's name

  constructor(o: FakeCloudOptions = {}) {
    this.user = o.account === undefined ? FakeCloudProvider.DEFAULT_ACCOUNT : o.account;
    this.data = o.data ?? null;
    if (this.data) this.modified = this.clock++;
    this.offline = o.offline ?? false;
    this.latency = o.latency ?? 0;
    this.declineSignIn = o.declineSignIn ?? false;
  }

  private async call(name: string, needsAccount = true): Promise<void> {
    this.calls.push(name);
    if (this.latency > 0) await new Promise((r) => setTimeout(r, this.latency));
    const fail = this.failNext;
    this.failNext = null;
    if (fail) throw new CloudError(fail);
    if (this.offline) throw new CloudError('offline');
    if (needsAccount && !this.user) throw new CloudError('signedOut');
  }

  async available(): Promise<boolean> {
    return true;
  }

  async account(): Promise<string | null> {
    this.calls.push('account');
    return this.user;
  }

  async signIn(): Promise<string | null> {
    await this.call('signIn', false);
    if (this.declineSignIn) return null;
    this.user ??= FakeCloudProvider.DEFAULT_ACCOUNT;
    return this.user;
  }

  async signOut(): Promise<void> {
    this.calls.push('signOut');
    this.user = null;
  }

  async load(): Promise<CloudBlob | null> {
    await this.call('load');
    return this.data === null ? null : { data: this.data, modified: this.modified };
  }

  async save(data: string, meta: CloudMeta): Promise<number> {
    await this.call('save');
    this.data = data;
    this.lastMeta = meta;
    this.modified = this.clock++;
    return this.modified;
  }
}
