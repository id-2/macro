import { t } from '@app/lib/i18n';
import type { CrmCompany } from './company';
import type { CrmPerson } from './people';

export type ExportColumn = { id: string; label: string; default?: boolean };
export const PEOPLE_EXPORT_COLUMNS: ExportColumn[] = [
  { id: 'name', get label() {
      return t('crm.name');
    }, default: true },
  { id: 'email', get label() {
      return t('crm.email');
    }, default: true },
  { id: 'companyName', get label() {
      return t('crm.company');
    }, default: true },
  { id: 'lastInteraction', get label() {
      return t('crm.lastContacted');
    }, default: true },
  { id: 'firstInteraction', get label() {
      return t('crm.firstContact');
    }, default: true },
  { id: 'createdAt', get label() {
      return t('crm.dateAdded');
    } },
  { id: 'id', get label() {
      return t('crm.contactId');
    } },
  { id: 'companyId', get label() {
      return t('crm.companyId');
    } },
];
export type ExportRecord = Record<
  string,
  string | number | boolean | null | undefined
>;

/** Quote RFC 4180 fields and neutralize spreadsheet formulas in text values. */
export function createCrmCsv(columns: ExportColumn[], rows: ExportRecord[]) {
  const cell = (value: ExportRecord[string]) => {
    let text = value == null ? '' : String(value);
    if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text))
      text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return (
    '\uFEFF' +
    [
      columns.map((column) => cell(column.label)).join(','),
      ...rows.map((row) =>
        columns.map((column) => cell(row[column.id])).join(',')
      ),
    ].join('\r\n') +
    '\r\n'
  );
}

export function companyExportRecord<P extends { definition: { id: string } }>(
  company: CrmCompany & { properties?: P[] },
  stage: string,
  owner: string,
  propertyValue: (property: P) => string | number | boolean
): ExportRecord {
  return {
    id: company.id,
    name: company.name,
    domains: company.domains.map((domain) => domain.domain).join('; '),
    stage,
    owner,
    lastInteraction: String(company.updatedAt ?? ''),
    firstInteraction: String(company.createdAt ?? ''),
    description: company.description,
    emailSync: company.emailSync,
    ...Object.fromEntries(
      (company.properties ?? []).map((property) => [
        `property:${property.definition.id}`,
        propertyValue(property),
      ])
    ),
  };
}
export function personExportRecord(person: CrmPerson): ExportRecord {
  return {
    id: person.id,
    name: person.name,
    email: person.email,
    companyName: person.companyName,
    companyId: person.companyId,
    firstInteraction: person.firstInteraction,
    lastInteraction: person.lastInteraction,
    createdAt: person.createdAt,
  };
}
