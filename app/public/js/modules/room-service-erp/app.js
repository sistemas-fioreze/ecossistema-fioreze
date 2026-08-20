import { setupDesktopBillingFilters } from "./desktop-billing-filters.js?v=20260819-1";
import { setupDesktopControls } from "./desktop-adapter.js?v=20260814-6";
import { setupDesktopLoadingExperience } from "./desktop-loading-experience.js?v=20260819-1";
import { setupIconSystem } from "./icon-system.js?v=20260814-6";
import { setupSidebarAccount } from "./sidebar-account.js?v=20260819-2";
import "./legacy-app.js?v=20260814-6";

setupIconSystem();
setupDesktopControls();
setupDesktopLoadingExperience();
setupSidebarAccount();
setupDesktopBillingFilters();
