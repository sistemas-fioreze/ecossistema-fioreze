import { build } from "esbuild";

const iconNames = [
  "Activity",
  "ArrowLeft",
  "ArrowRight",
  "BedDouble",
  "Bell",
  "BookOpen",
  "Bookmark",
  "CalendarDays",
  "Check",
  "ChevronDown",
  "ChevronLeft",
  "ChevronRight",
  "CircleAlert",
  "CircleDollarSign",
  "CircleHelp",
  "ClipboardCheck",
  "ClipboardList",
  "Clock3",
  "Copy",
  "CreditCard",
  "DollarSign",
  "Download",
  "Eye",
  "FileDown",
  "FileText",
  "GripVertical",
  "History",
  "Image",
  "Info",
  "KeyRound",
  "LayoutDashboard",
  "List",
  "LogOut",
  "Menu",
  "Minus",
  "Monitor",
  "Moon",
  "NotebookText",
  "Package",
  "Palette",
  "PanelRightClose",
  "Pencil",
  "Pin",
  "Plus",
  "Printer",
  "ReceiptText",
  "RefreshCw",
  "Search",
  "Settings",
  "ShoppingCart",
  "SlidersHorizontal",
  "Square",
  "Store",
  "Ticket",
  "Trash2",
  "TriangleAlert",
  "UserRound",
  "Users",
  "Volume2",
  "X",
];

const imports = ["createIcons", ...iconNames].join(", ");
const iconEntries = iconNames.join(",\n    ");

await build({
  stdin: {
    contents: `
      import { ${imports} } from "lucide";
      globalThis.FiorezeLucide = Object.freeze({
        createIcons,
        icons: Object.freeze({
          ${iconEntries}
        })
      });
    `,
    loader: "js",
    resolveDir: process.cwd(),
    sourcefile: "erp-lucide-entry.js",
  },
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  outfile: "public/js/vendor/lucide-erp.min.js",
  legalComments: "eof",
});
