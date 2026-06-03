export default function MainArea() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#f5f5f7]">
      <div className="flex-shrink-0 p-5 pb-3">
        <p className="pb-1 text-[11px] font-semibold uppercase tracking-widest text-[#aeaeb2]">
          Search
        </p>
        <div className="rounded-lg border border-black/[0.14] bg-white px-3 py-2 text-[14px] text-[#aeaeb2] shadow-sm">
          Search field
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden px-5 pb-5">
        <p className="pb-1 text-[11px] font-semibold uppercase tracking-widest text-[#aeaeb2]">
          Results
        </p>
        <div className="flex-1 rounded-lg border border-black/[0.08] bg-white/50 text-[12px] text-[#aeaeb2] p-3">
          Search results
        </div>
      </div>
    </div>
  )
}
