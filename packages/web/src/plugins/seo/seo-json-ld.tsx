/**
 * Renders each `buildJsonLd` node as its own `<script type="application/ld+json">`
 * (plugin-seo Spec §3) — a plain server component, same precedent
 * `ExamplePlugin` set: no client interactivity. The `<`/`>` escape is
 * deliberate: `name`/`description` are free-form CMS text and must never be
 * trusted not to contain a literal `</script>` that would break out of the
 * tag — escaping both angle brackets (not just `<`) means no substring of
 * the escaped payload can ever read back as a tag delimiter.
 */
export function SeoJsonLd({ data }: { data: Record<string, unknown>[] }) {
  return (
    <>
      {data.map((entry, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(entry).replace(/[<>]/g, (char) => (char === '<' ? '\\u003c' : '\\u003e')),
          }}
        />
      ))}
    </>
  );
}
