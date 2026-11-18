import { ToolHeader } from "@/components/tools/ToolHeader";
import { localeHref } from "@/content/i18n";
import { Container } from "@/components/Container";
import { ui } from "@/tools/ai-workflow-blueprint/ui";
import { Blueprint } from "@/tools/ai-workflow-blueprint/Blueprint";
import { copy } from "@/tools/ai-workflow-blueprint/copy";
import { manifest } from "@/tools/ai-workflow-blueprint/manifest";
import styles from "@/tools/ai-workflow-blueprint/blueprint.module.css";
export default function Page({ locale }: { locale: 'en' | 'de' }) {
  const c = copy[locale];
  return <>
    <ToolHeader tool="ai-workflow-blueprint" locale={locale} title={c.title} lead={ui[locale].lead} />
    <Container><Blueprint locale={locale} /></Container>
    <section className="border-t border-line py-12"><Container>
      <details><summary className="cursor-pointer font-medium">{c.methodology}</summary><p className="mt-4 max-w-3xl text-muted leading-relaxed">{c.methodText}</p></details>
      <p className="mt-8 text-muted">{locale === "de" ? "Unterstützung bei der Umsetzung:" : "Support with implementation:"}</p>
      <div className="mt-3 flex flex-wrap gap-6"><a className={styles.link} href={localeHref(locale, "/services/ai-integration")}>{locale === "de" ? "KI-Integration" : "AI integration"} ↗</a><a className={styles.link} href={localeHref(locale, "/services/custom-ai-tools")}>{locale === "de" ? "Individuelle KI-Tools" : "Custom AI tools"} ↗</a></div>
    </Container></section>
  </>;
}
