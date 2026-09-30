/**
 * Picks the Ukrainian plural form for a count: 1 товар, 2 товари, 5 товарів.
 * Rules follow the standard `one/few/many` selection used by Intl.PluralRules.
 */
export function plural(count: number, forms: { one: string; few: string; many: string }): string {
  const rules = new Intl.PluralRules("uk-UA");
  const category = rules.select(count);

  return forms[category as keyof typeof forms] ?? forms.many;
}
