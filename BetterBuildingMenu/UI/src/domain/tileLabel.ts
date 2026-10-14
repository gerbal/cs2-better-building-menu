/**
 * Shortening a name inside its words, the name planner's last resort and the cards' cap on a name.
 * Catalog names are longest at the front and distinguished at the back, so clipping from the right
 * makes many buildings read alike: the tail is kept, the head is spent, and the hover card has the
 * whole.
 */

/**
 * What the ellipsis costs, in characters of the budget. More than one: the mark
 * is nearly two average characters wide, and what survives an elision keeps the
 * capitals and drops the spaces. Undercharged, a cut runs past its line.
 */
const ELLIPSIS_CHARS = 3;

/**
 * The tail of a name, preferring a whole word: a boundary within reach of the
 * cut wins over the exact character count, because half a word costs the same
 * and distinguishes nothing.
 */
const tailOf = (name: string, tailLength: number): string => {
  const cut = name.length - tailLength;
  const boundary = name.lastIndexOf(" ", cut);

  if (boundary >= 0) {
    const word = name.slice(boundary + 1);

    // One character of slack, so a boundary just past the cut still wins.
    if (word.length > 0 && word.length <= tailLength + 1) {
      return word;
    }
  }

  return name.slice(cut).trimStart();
};

/**
 * Keep the end of the name, and as much of the start as still fits. A real
 * ellipsis character rather than CSS's, because CSS can only elide at an edge
 * and the information is at both: the head says what kind, the tail says which.
 */
export const shortenTileLabel = (label: string, budget: number): string => {
  const name = (label ?? "").trim();
  if (budget <= 1 || name.length <= budget) return name;

  // What the text may occupy once the ellipsis has been paid for.
  const usable = Math.max(1, budget - ELLIPSIS_CHARS);

  // Enough tail to carry the distinguishing suffix (levels, lot sizes, indices),
  // enough head to still recognise the family.
  const tailLength = Math.max(1, Math.min(name.length - 1, Math.ceil(usable * 0.45)));
  const tail = tailOf(name, tailLength);
  const headLength = usable - tail.length;

  // trimStart on the tail: a slice that lands mid-gap spends a character of a
  // budget this tight on a space that reads as nothing.
  if (headLength <= 0) return `…${tail}`;

  return `${name.slice(0, headLength).trimEnd()}…${tail}`;
};

/**
 * The longest name the list and card rows draw whole. Those rows grow to fit
 * their name, which is the point of them, but an asset that ships its name
 * repeated (one does, six times over) would stretch its row across the asset menu.
 * Set well above real names ("Fishing And Open Water Fish Farming Area Hub" is
 * 44), so it only catches names like that one; the hover card has the whole.
 */
export const LIST_NAME_MAX_CHARS = 56;

/**
 * A list or card row's name: whole, unless it runs past LIST_NAME_MAX_CHARS.
 */
export const listLabel = (label: string): string => shortenTileLabel(label, LIST_NAME_MAX_CHARS);
