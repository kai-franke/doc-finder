export default function TitleBar() {
  return (
    <div
      className="flex h-[38px] w-full flex-shrink-0 items-center bg-[#ececec] border-b border-black/[0.08] px-4"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <span className="absolute left-1/2 -translate-x-1/2 text-[13px] font-medium text-[#6e6e73] tracking-tight select-none">
        DocFinder
      </span>
    </div>
  )
}
