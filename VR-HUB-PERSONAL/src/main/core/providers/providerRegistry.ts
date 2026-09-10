import { GameProfile, LibraryGame, ProviderId } from '../model/types';
import { VRProvider } from './provider';

/**
 * Registro dei provider VR disponibili (spec §11/§92). Aggiungere un nuovo
 * provider (REFramework, NativeMod, SourceVR, QuestPort, ...) significa
 * istanziarlo altrove e chiamare `register()`, senza toccare UI o database.
 */
export class ProviderRegistry {
  private readonly providers = new Map<ProviderId, VRProvider>();

  register(provider: VRProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(providerId: ProviderId): VRProvider | null {
    return this.providers.get(providerId) ?? null;
  }

  list(): VRProvider[] {
    return [...this.providers.values()];
  }

  /** Trova il primo provider registrato che dichiara di poter gestire questo gioco/profilo. */
  findApplicable(game: LibraryGame, profile: GameProfile): VRProvider | null {
    for (const provider of this.providers.values()) {
      if (provider.detect(game, profile)) return provider;
    }
    return null;
  }
}
