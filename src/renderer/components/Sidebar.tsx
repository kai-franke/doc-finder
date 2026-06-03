export default function Sidebar() {
  return (
    <div className="flex w-60 flex-shrink-0 flex-col overflow-hidden border-r border-black/[0.14] bg-[#ececec]">
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-widest text-[#aeaeb2]">
          Folders
        </p>
        <div className="flex-1 rounded-md bg-black/[0.04] px-2 py-2 text-[12px] text-[#6e6e73]">
          Folder list
        </div>
      </div>

      <div className="border-t border-black/[0.08] p-3">
        <p className="pb-2 text-[11px] font-semibold uppercase tracking-widest text-[#aeaeb2]">
          Index Status
        </p>
        <div className="rounded-md bg-black/[0.04] px-2 py-2 text-[12px] text-[#6e6e73]">
          Index status
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#aeaeb2]">
          <div className="h-1.5 w-1.5 rounded-full bg-[#aeaeb2]" />
          Ollama
        </div>
      </div>
    </div>
  )
}
