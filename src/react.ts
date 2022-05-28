import { Env } from "./env.js";

type ReactionType = "sadge" | "pog" | "monak" | "weirdge" | "jebait" | "kappa";

function ordinal_suffix_of(i: bigint) {
    var j = i % 10n,
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

export const react = async (emote: string, env: Env): Promise<string> => {
    const reactionType = emote as ReactionType;
    switch (reactionType) {
        case ("sadge"): {
            return await getAndIncrement(reactionType, env.KV);
        }
        case ("pog"): {
            return await getAndIncrement(reactionType, env.KV);
        }
        case ("monak"): {
            return await getAndIncrement(reactionType, env.KV);
        }
        case ("weirdge"): {
            return await getAndIncrement(reactionType, env.KV);
        }
        case ("jebait"): {
            return await getAndIncrement(reactionType, env.KV);
        }
        case ("kappa"): {
            return await getAndIncrement(reactionType, env.KV);
        }
        default: {
            const exhaustiveCheck: never = reactionType;
            throw new Error(exhaustiveCheck);
        }
    }
}

const getAndIncrement = async (reactionType: ReactionType, kvNamespace: KVNamespace): Promise<string> => {
    const val = await kvNamespace.get(reactionType);
    const bigInt = (val ? BigInt(val) : BigInt(0)) + 1n;
    await kvNamespace.put(reactionType, bigInt.toString());
    return ordinal_suffix_of(bigInt);
}