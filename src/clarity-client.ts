/** Browser entry for Microsoft Clarity, bundled to /vendor/clarity.js at build time. */
import Clarity from "@microsoft/clarity";

declare const document: {
  currentScript: { getAttribute(name: string): string | null } | null;
};

const projectId = document.currentScript?.getAttribute("data-project") ?? "";

if (projectId) Clarity.init(projectId);
