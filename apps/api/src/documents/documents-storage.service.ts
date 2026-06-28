import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

@Injectable()
export class DocumentsStorageService {
  private readonly root: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.root = config.get<string>("LOCAL_STORAGE_ROOT") ?? path.join(process.cwd(), ".local-storage");
  }

  async write(key: string, content: Buffer) {
    const normalizedKey = normalizeObjectKey(key);
    const target = path.join(this.root, normalizedKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
    return normalizedKey;
  }

  async read(key: string) {
    return readFile(path.join(this.root, normalizeObjectKey(key)));
  }
}

function normalizeObjectKey(key: string) {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..")) {
    throw new Error("Storage key cannot contain parent directory traversal.");
  }
  return normalized;
}
