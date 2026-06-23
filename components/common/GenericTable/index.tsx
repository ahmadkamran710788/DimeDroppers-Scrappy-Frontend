import { cn } from "@/utils/cn";

export interface Column<T> {
  key: keyof T & string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface GenericTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  maxHeightClassName?: string;
  className?: string;
}

function GenericTable<T extends Record<string, unknown>>({
  columns,
  data,
  emptyMessage = "No data",
  maxHeightClassName = "max-h-[28rem]",
  className,
}: GenericTableProps<T>) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-neutral-400">{emptyMessage}</p>
    );
  }

  return (
    <div
      className={cn(
        "overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-700",
        maxHeightClassName,
        className
      )}
    >
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-800">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="whitespace-nowrap px-4 py-2.5 font-medium text-neutral-600 dark:text-neutral-300"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              className="border-t border-neutral-100 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "px-4 py-2 text-neutral-800 dark:text-neutral-200",
                    col.className
                  )}
                >
                  {col.render ? col.render(row) : String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default GenericTable;
