import { setupDesktopBillingFilters } from "./desktop-billing-filters.js?v=20260819-3";
import { setupDesktopControls } from "./desktop-adapter.js?v=20260814-6";
import { setupDesktopLoadingExperience } from "./desktop-loading-experience.js?v=20260819-3";
import { setupDesktopTitlebarPolish } from "./desktop-titlebar-polish.js?v=20260819-2";
import { setupErpEasterEgg } from "./easter-egg.js?v=20260821-1";
import { setupIconSystem } from "./icon-system.js?v=20260814-6";
import { setupSidebarAccount } from "./sidebar-account.js?v=20260820-1";
import { setupErpPortuguesePolish } from "./ui-language-polish.js?v=20260819-1";
import "./legacy-app.js?v=20260820-6";

setupIconSystem();
setupErpEasterEgg();
setupErpPortuguesePolish();
setupDesktopTitlebarPolish();
setupDesktopControls();
setupDesktopLoadingExperience();
setupSidebarAccount();
setupDesktopBillingFilters();
