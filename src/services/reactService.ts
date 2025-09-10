import { inject, injectable } from 'tsyringe';
import type { Env } from '../env';
import { ObjectStorage } from './objectStorage';

type ReactionType = "sadge" | "pog" | "monak" | "weirdge" | "jebait" | "kappa";

function ordinal_suffix_of(i: bigint) {
  const j = i % 10n,
    k = i % 100n;
  if (j == 1n && k != 11n) {
    return i + "st";
  }
  if (j == 2n && k != 12n) {
    return i + "nd";
  }
  if (j == 3n && k != 13n) {
    return i + "rd";
  }
  return i + "th";
}

/**
 * React Service
 * Encapsulates all React API calls
 */
@injectable()
export class ReactService {

  constructor(@inject('Env') private env: Env, @inject(ObjectStorage) private kv: ObjectStorage) { }

  async react(emote: string): Promise<string> {
    const reactionType = emote as ReactionType;
    switch (reactionType) {
      case "sadge":
      case "pog":
      case "monak":
      case "weirdge":
      case "jebait":
      case "kappa": {
        return await this.getAndIncrement(reactionType);
      }
      default: {
        const exhaustiveCheck: never = reactionType;
        throw new Error(exhaustiveCheck);
      }
    }
  }

  async getAndIncrement(reactionType: ReactionType): Promise<string> {
    const val = await this.kv.get('ReactService', reactionType);
    const bigInt = (val ? BigInt(val) : BigInt(0)) + 1n;
    await this.kv.put('ReactService', reactionType, bigInt.toString());
    return ordinal_suffix_of(bigInt);
  }
}
