import type { SourceFolder } from "../../shared/types";

type FolderListProps = {
  folders: SourceFolder[];
  onRemove: (folderPath: string) => void;
};

function FolderList({ folders, onRemove }: FolderListProps): React.JSX.Element {
  if (folders.length === 0) {
    return (
      <div className="flex flex-col gap-1" aria-label="Folder list">
        <div className="rounded-md px-2 py-[7px] text-xs leading-snug text-[#aeaeb2]">
          No folders added yet
        </div>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1" aria-label="Folder list">
      {folders.map((folder) => (
        <li
          key={folder.path}
          className="group flex items-center gap-2 rounded-md px-2 py-[7px] transition hover:bg-black/5"
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <span
              className={`truncate text-[12.5px] font-medium ${
                folder.accessible ? "text-[#1d1d1f]" : "text-[#aeaeb2]"
              }`}
              title={folder.path}
            >
              {folder.label}
            </span>
            <span role="status" className="text-[11px]">
              {!folder.accessible ? (
                <span className="text-[11px] text-[#ff3b30]">
                  Folder not found
                </span>
              ) : folder.pdfCount === null ? (
                <span className="flex items-center gap-1.5 text-[11px] text-[#aeaeb2]">
                  <svg
                    className="h-3 w-3 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="opacity-25"
                    />
                    <path
                      d="M12 2a10 10 0 0 1 10 10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                  Count PDFs…
                </span>
              ) : (
                <span className="text-[11px] text-[#aeaeb2]">
                  {folder.pdfCount} {folder.pdfCount === 1 ? "PDF" : "PDFs"}
                </span>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onRemove(folder.path)}
            aria-label="Remove folder"
            className={`app-no-drag flex h-4 w-4 shrink-0 cursor-default items-center justify-center rounded-full text-[#6e6e73] transition hover:bg-black/10 hover:text-[#1d1d1f] ${
              folder.accessible
                ? "opacity-0 group-hover:opacity-100"
                : "opacity-100"
            }`}
          >
            <svg
              width="9"
              height="9"
              viewBox="0 0 9 9"
              fill="none"
              aria-hidden="true"
            >
              <line
                x1="1"
                y1="1"
                x2="8"
                y2="8"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <line
                x1="8"
                y1="1"
                x2="1"
                y2="8"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default FolderList;
