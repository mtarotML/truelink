export function Logo({ className = "" }: { className?: string }) {
  return (
    <h1
      className={`text-center font-extrabold tracking-tight text-5xl ${className}`}
    >
      <span className="text-white">True</span>
      <span className="text-pink">Link</span>
    </h1>
  );
}
