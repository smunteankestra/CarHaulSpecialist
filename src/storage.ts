/**
 * File storage: R2 when the bucket is bound, KV as the fallback.
 *
 * The app was built on KV, which caps a free account at 1 GB and 1,000 writes
 * per day. R2 gives 10 GB and no daily write ceiling for the same three calls,
 * so every caller goes through this module and the binding decides the backend.
 */

export interface StorageEnv {
  /** R2 bucket, once `wrangler.jsonc` binds one. */
  UPLOADS_R2?: R2Bucket;
  /** KV namespace, the original storage. */
  UPLOADS?: KVNamespace;
}

export function storageBackend(env: StorageEnv): "r2" | "kv" | "none" {
  if (env.UPLOADS_R2) return "r2";
  if (env.UPLOADS) return "kv";
  return "none";
}

export async function putObject(env: StorageEnv, key: string, body: ArrayBuffer | Uint8Array, contentType: string): Promise<void> {
  if (env.UPLOADS_R2) {
    await env.UPLOADS_R2.put(key, body, { httpMetadata: { contentType } });
    return;
  }
  if (env.UPLOADS) {
    await env.UPLOADS.put(key, body, { metadata: { contentType } });
    return;
  }
  throw new Error("No storage binding configured");
}

export async function getObject(
  env: StorageEnv,
  key: string,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  if (env.UPLOADS_R2) {
    const object = await env.UPLOADS_R2.get(key);
    if (object) {
      return {
        body: await object.arrayBuffer(),
        contentType: object.httpMetadata?.contentType ?? "application/octet-stream",
      };
    }
    // During the migration a file may still live only in KV: serve it and copy it over.
    if (env.UPLOADS) {
      const legacy = await env.UPLOADS.getWithMetadata<{ contentType?: string }>(key, "arrayBuffer");
      if (legacy.value) {
        const contentType = legacy.metadata?.contentType ?? "application/octet-stream";
        await env.UPLOADS_R2.put(key, legacy.value, { httpMetadata: { contentType } });
        return { body: legacy.value, contentType };
      }
    }
    return null;
  }
  if (env.UPLOADS) {
    const object = await env.UPLOADS.getWithMetadata<{ contentType?: string }>(key, "arrayBuffer");
    if (!object.value) return null;
    return {
      body: object.value,
      contentType: object.metadata?.contentType ?? "application/octet-stream",
    };
  }
  return null;
}

export async function deleteObject(env: StorageEnv, key: string): Promise<void> {
  // Remove from both stores so a half-migrated file cannot linger anywhere.
  if (env.UPLOADS_R2) await env.UPLOADS_R2.delete(key);
  if (env.UPLOADS) await env.UPLOADS.delete(key);
}
