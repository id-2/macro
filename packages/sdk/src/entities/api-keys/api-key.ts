import type { UserApiKeyInfo } from '../../../generated/storage/types.gen';
import { RoxNotFoundError, unwrap } from '../../utils';
import type { RoxClient } from '../../utils/client';
import { RoxEntity } from '../entity';

/** A user API key's metadata. Secrets are returned only at creation. */
export class UserApiKey extends RoxEntity<UserApiKeyInfo> {
  /** Construct a lazy key handle. */
  static byId(client: RoxClient, id: string): UserApiKey {
    return new UserApiKey(client, id);
  }

  /** Seed from metadata, deliberately excluding the secret. */
  static from(client: RoxClient, record: UserApiKeyInfo): UserApiKey {
    return new UserApiKey(client, record.id, {
      id: record.id,
      name: record.name,
      createdAt: record.createdAt,
    });
  }

  protected async fetch(): Promise<UserApiKeyInfo> {
    const record = unwrap(
      await this.client.storage.listUserApiKeys(),
    ).keys.find((k) => k.id === this.id);
    if (!record)
      throw new RoxNotFoundError(`API key ${this.id} is unavailable`);
    return record;
  }

  /** Human readable label. */
  readonly name = this.field('name');

  /** Creation time. */
  readonly createdAt = this.field('createdAt');

  /**
   * Revoke this key.
   *
   * @destructive
   * @idempotent
   */
  async delete(): Promise<void> {
    await this.mutate((c) =>
      c.storage.deleteUserApiKey({ path: { id: this.id } }),
    );
  }
}
