export interface CitationCheck {
  /** Valid source numbers, in order of first use. */
  cited: number[];
  /** Numbers that refer to no source, e.g. [9] when there are 6 sources. */
  invalid: number[];
}

/**
 * Finds [n] markers in an answer and checks them against the sources that
 * were actually given to the model. Accepts "[1]", "[1][3]" and "[1, 3]".
 */
export function checkCitations(
  answer: string,
  sourceCount: number,
): CitationCheck {
  const cited: number[] = [];
  const invalid: number[] = [];

  for (const match of answer.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)) {
    for (const part of match[1].split(',')) {
      const n = Number(part.trim());
      const target = n >= 1 && n <= sourceCount ? cited : invalid;
      if (!target.includes(n)) target.push(n);
    }
  }
  return { cited, invalid };
}
