import { TOOL_ID, type Inputs, type Locale, type Model, type Step, type Template } from "./model";
const specifics: Record<Locale, Record<Template, [string, string, string, string, string, string]>> = {
  en: {
    knowledge: ["Answer staff questions with verifiable internal evidence", "Employee submits a question", "Approved handbook and access-controlled project notes", "Answer with source references or a clear refusal", "Retrieve only sources this employee may access", "Draft an answer with citations; abstain if evidence is insufficient"],
    triage: ["Route customer enquiries to the right team", "New enquiry arrives in the shared inbox", "Enquiry text, consent status and team routing guide", "Categorized enquiry and an approved acknowledgement", "Read enquiry and current routing rules", "Classify intent, urgency and proposed team; flag ambiguity"],
    extraction: ["Turn supplier documents into validated draft records", "A supplier document enters the review folder", "Fictional supplier PDF and agreed field schema", "Approved record with supplier, date, currency and total", "Read document and field schema; retain page references", "Extract fields with page references and mark missing values"],
    proposal: ["Prepare evidence-based proposal drafts for review", "Account owner accepts a qualified request", "Approved service catalogue, price list and request notes", "Reviewed proposal sent to an authorized recipient", "Retrieve current catalogue and approved pricing", "Draft proposal with explicit scope, exclusions and source references"],
    reporting: ["Prepare a recurring operational report", "Weekly schedule after the data cutoff", "Approved operational exports and metric definitions", "Reviewed report distributed to approved recipients", "Retrieve dated exports and validate the reporting window", "Compute agreed metrics and draft a referenced commentary"],
  },
  de: {
    knowledge: ["Mitarbeiterfragen mit überprüfbaren internen Belegen beantworten", "Eine Person stellt eine Frage", "Freigegebenes Handbuch und zugriffsgeschützte Projektnotizen", "Antwort mit Quellenverweisen oder klarer Ablehnung", "Nur Quellen abrufen, auf die diese Person zugreifen darf", "Antwort mit Quellen entwerfen; bei fehlenden Belegen verzichten"],
    triage: ["Kundenanfragen dem richtigen Team zuordnen", "Neue Anfrage im gemeinsamen Postfach", "Anfragetext, Einwilligungsstatus und Zuordnungsleitfaden", "Kategorisierte Anfrage und freigegebene Empfangsbestätigung", "Anfrage und aktuelle Zuordnungsregeln lesen", "Absicht, Dringlichkeit und Team bestimmen; Unklarheiten markieren"],
    extraction: ["Lieferantendokumente in validierte Datenentwürfe umwandeln", "Ein Lieferantendokument geht im Prüfungsordner ein", "Fiktives Lieferanten-PDF und vereinbartes Feldschema", "Freigegebener Datensatz mit Lieferant, Datum, Währung und Summe", "Dokument und Feldschema lesen; Seitenverweise erhalten", "Felder mit Seitenverweisen auslesen und fehlende Werte markieren"],
    proposal: ["Belegte Angebotsentwürfe zur Prüfung vorbereiten", "Verantwortliche Person nimmt qualifizierte Anfrage an", "Freigegebener Leistungskatalog, Preisliste und Anfragenotizen", "Geprüftes Angebot an eine autorisierte Person versenden", "Aktuellen Katalog und freigegebene Preise abrufen", "Angebot mit Umfang, Ausschlüssen und Quellenverweisen entwerfen"],
    reporting: ["Einen regelmässigen Betriebsbericht vorbereiten", "Wöchentlicher Termin nach dem Datenstichtag", "Freigegebene Betriebsexporte und Kennzahlendefinitionen", "Geprüfter Bericht für freigegebene Empfänger", "Datierte Exporte abrufen und Berichtszeitraum prüfen", "Vereinbarte Kennzahlen berechnen und belegte Erläuterung entwerfen"],
  },
};
export function preset(template: Template, locale: Locale): Model {
  const de = locale === "de", s = specifics[locale][template];
  const inputs: Inputs = {
    objective: s[0], trigger: s[1], sources: s[2], output: s[3],
    scope: de ? "Pilot mit einem Team und freigegebenen Beispieldaten." : "Pilot with one team and approved sample data.",
    exclusions: de ? "Keine autonome Richtlinienentscheidung; keine ungeprüften externen Aktionen." : "No autonomous policy decisions; no unreviewed external actions.",
    people: de ? "Anfragende Person, Fachprüfung, Prozessverantwortung" : "Requester, domain reviewer, process owner",
    software: template === "extraction" ? "SharePoint → ERP" : template === "triage" ? "Outlook → CRM" : "SharePoint → Teams",
    success: de ? "Illustratives Ziel: 20 Testfälle; keine unberechtigten Zugriffe; alle abgelehnten Aktionen blockiert. Qualitätsschwelle mit dem Team festlegen." : "Illustrative target: 20 test cases; zero unauthorized accesses; all rejected actions blocked. Agree the quality threshold with the team.",
    owner: de ? "Ungeklärt: Prozessverantwortung benennen" : "Unresolved: name the process owner",
    monitoring: de ? "Fehler, abgelehnte Freigaben und Quellenabdeckung je Lauf protokollieren; tägliche Prüfung im Pilot." : "Log failures, rejected approvals and source coverage per run; review daily during the pilot.",
    assumptions: de ? "Ungeklärt: Datenrechte, Aufbewahrung, Qualitätsschwelle, Budget und verfügbare Schnittstellen." : "Unresolved: data rights, retention, quality threshold, budget and available interfaces.",
    authorization: de ? "Ungeklärt: erlaubte Empfänger, Datensätze, Zugriffsrollen und Freigabeverantwortung festlegen." : "Unresolved: define allowed recipients, records, access roles and approval authority.",
  };
  const make = (id: string, type: Step["type"], label: string, input: string, output: string, system: string): Step => ({
    id, type, label, input, output, system,
    role: type === "review" || type === "fallback" ? (de ? "Fachprüfung" : "Domain reviewer") : (de ? "Prozessverantwortung" : "Process owner"),
    permissions: type === "action" ? (de ? "Nur freigegebene Empfänger / Datensätze; minimale Schreibrechte" : "Approved recipients / records only; minimum write access") : (de ? "Minimaler Lesezugriff; rollenbezogene Quellenrechte" : "Minimum read access; role-based source rights"),
    failure: de ? "Stoppen, Kontext protokollieren und an Fachprüfung übergeben." : "Stop, log context and hand over to the domain reviewer.",
  });
  const steps = [
    make("trigger", "trigger", s[1], s[1], de ? "Identifizierter Auftrag" : "Identified request", de ? "Eingang / Zeitplan" : "Inbox / scheduler"),
    make("source", "source", s[4], s[2], de ? "Zugängliche Quellen mit Verweisen" : "Accessible sources with references", "SharePoint"),
    make("task", "task", s[5], de ? "Geprüfte Quellen" : "Checked sources", s[3], de ? "Geplante KI-Komponente" : "Proposed AI component"),
    make("validate", "validation", template === "extraction" ? (de ? "Pflichtfelder, Datum, Währung und Summe prüfen" : "Validate required fields, date, currency and total") : (de ? "Belege, Qualität und Ausgabeformat prüfen" : "Validate evidence, quality and output format"), s[3], de ? "Validierter Entwurf" : "Validated draft", de ? "Regelprüfung" : "Rules validator"),
    make("review", "review", de ? "Entwurf und externe Aktion freigeben" : "Approve draft and external action", de ? "Validierter Entwurf" : "Validated draft", de ? "Freigabe oder Ablehnung" : "Approval or rejection", de ? "Prüfwarteschlange" : "Review queue"),
    make("action", "action", template === "extraction" ? (de ? "Freigegebenen Datensatz schreiben" : "Write approved record") : (de ? "Freigegebenes Ergebnis bereitstellen" : "Deliver approved output"), de ? "Freigegebener Entwurf" : "Approved draft", s[3], template === "extraction" ? "ERP" : template === "triage" ? "CRM / Outlook" : "Teams"),
    make("fallback", "fallback", template === "extraction" ? (de ? "Feldkorrektur anfordern; neuen Lauf starten" : "Request field correction; start a new run") : (de ? "Keine Aktion; Belege anfordern oder eskalieren" : "Take no action; request evidence or escalate"), de ? "Fehler- oder Ablehnungsgrund" : "Failure or rejection reason", de ? "Manuelle Klärung; kein automatischer Wiederholungszyklus" : "Manual resolution; no automatic retry cycle", de ? "Prüfwarteschlange" : "Review queue"),
    make("done", "completion", de ? "Ergebnis oder Ausnahme dokumentieren" : "Record outcome or exception", de ? "Ergebnisstatus" : "Outcome status", de ? "Prüfbarer Abschluss" : "Auditable completion", de ? "Protokoll" : "Audit log"),
  ];
  return { tool: TOOL_ID, schemaVersion: 1, methodologyVersion: 1, locale, template, approval: "each", restrictedSources: template === "knowledge", inputs, steps, edges: [
    { from: "trigger", to: "source", condition: "success" }, { from: "source", to: "task", condition: "success" },
    { from: "source", to: "fallback", condition: "failure" }, { from: "task", to: "validate", condition: "success" },
    { from: "task", to: "fallback", condition: template === "knowledge" ? "insufficient" : "failure" },
    { from: "validate", to: "review", condition: "success" }, { from: "validate", to: "fallback", condition: "invalid" },
    { from: "review", to: "action", condition: "approved" }, { from: "review", to: "fallback", condition: "rejected" },
    { from: "action", to: "done", condition: "success" }, { from: "action", to: "fallback", condition: "failure" },
    { from: "fallback", to: "done", condition: "success" },
  ], brief: {} };
}
export function changeApproval(model: Model, approval: Model["approval"]): Model {
  const de = model.locale === "de";
  return { ...model, approval, steps: model.steps.map(s => (s.type === "review" || s.type === "validation") && model.edges.some(e => e.from === s.id && e.condition === "approved" && model.steps.some(target => target.id === e.to && target.type === "action")) ? {
    ...s, type: approval === "each" ? "review" : "validation",
    label: approval === "each" ? (de ? "Entwurf und externe Aktion freigeben" : "Approve draft and external action") : (de ? "Vorab erteilte Berechtigung und Grenzen prüfen" : "Check prior authorization and limits"),
  } : s) };
}
