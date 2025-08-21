import { injectable } from 'tsyringe';
import { Env } from '../types.js';

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

const getAndIncrement = async (reactionType: ReactionType, kvNamespace: KVNamespace): Promise<string> => {
    const val = await kvNamespace.get(reactionType);
    const bigInt = (val ? BigInt(val) : BigInt(0)) + 1n;
    await kvNamespace.put(reactionType, bigInt.toString());
    return ordinal_suffix_of(bigInt);
};

/**
 * React Service
 * Encapsulates all React API calls
 */
@injectable()
export class ReactService {
  async react(emote: string, env: Env): Promise<string> {
    const reactionType = emote as ReactionType;
    switch (reactionType) {
      case "sadge":
      case "pog":
      case "monak":
      case "weirdge":
      case "jebait":
      case "kappa": {
        return await getAndIncrement(reactionType, env.KV);
      }
      default: {
        const exhaustiveCheck: never = reactionType;
        throw new Error(exhaustiveCheck);
      }
    }
  }
}
