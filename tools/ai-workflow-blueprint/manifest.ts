import { copy } from "./copy";
export const manifest = {
  id: "ai-workflow-blueprint", practice: "ai", path: "/tools/ai-workflow-blueprint",
  title: { en: copy.en.title, de: copy.de.title },
  description: { en: copy.en.description, de: copy.de.description },
  relatedServicePaths: ["/services/ai-integration", "/services/custom-ai-tools"],
  schemaVersion: 1, methodologyVersion: 1,
} as const;
