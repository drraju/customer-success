"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="card">
      <h1>Something went wrong</h1>
      <p className="lede">The page could not be loaded.</p>
      <button className="btn" type="button" onClick={() => reset()}>
        Try again
      </button>
    </section>
  );
}
