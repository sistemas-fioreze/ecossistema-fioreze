import { setupDesktopControls } from "./desktop-adapter.js?v=20260814-6";
import { setupIconSystem } from "./icon-system.js?v=20260814-6";
import { setupSidebarAccount } from "./sidebar-account.js?v=20260819-1";
import "./legacy-app.js?v=20260814-6";

setupIconSystem();
setupDesktopControls();
setupSidebarAccount();
