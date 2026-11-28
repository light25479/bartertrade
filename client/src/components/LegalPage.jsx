import usePageTitle from '../usePageTitle';

export default function LegalPage({ title, updated, intro, sections }) {
  usePageTitle(title);

  return (
    <div className="card legal">
      <h2>{title}</h2>
      <p className="meta">Last updated: {updated}</p>
      {intro && <p>{intro}</p>}
      {sections.map((s) => (
        <section key={s.title}>
          <h3>{s.title}</h3>
          {s.body.map((b, i) =>
            typeof b === 'string' ? (
              <p key={i}>{b}</p>
            ) : (
              <ul key={i}>{b.list.map((li) => <li key={li}>{li}</li>)}</ul>
            )
          )}
        </section>
      ))}
    </div>
  );
}