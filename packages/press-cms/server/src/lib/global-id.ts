/**
 * Mirrors lodash `_.upperFirst(_.camelCase(input))` for the `component_<uid>`
 * globalId derivation used by Strapi's component loader.
 *
 * Inputs are assumed lowercase/kebab (e.g. "component_press.hero");
 * mixed-case inputs will produce correct camelCase but the round-trip is not
 * guaranteed to be stable if the caller passes already-cased strings.
 */
export const toGlobalId = (input: string): string => {
  const camel = input
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join('');
  return camel.charAt(0).toUpperCase() + camel.slice(1);
};
