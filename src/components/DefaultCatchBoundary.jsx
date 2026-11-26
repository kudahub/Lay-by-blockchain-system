export default function DefaultCatchBoundary({ error }) {
  return <div role="alert">{error?.message || "Something went wrong"}</div>;
}
